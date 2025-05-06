import { robotController } from "./RobotEEControl"
import { RotaryEncoder } from "./devices"
import { Button } from "./devices"
import { Axis } from "./devices"
import { controls, currentControls, setCurrentLayer, toggleLayer } from "./gui"
import { decrementCameraAngle, incrementCameraAngle, moveCamera, moveCameraAmt, setCameraAngle } from "./camera"
import { cameraLimits } from "./camera"
import mapping from "../config/mapping.json" assert { type: "json" }
import { storeManager } from "./State"


// Store devices
// can't be initialized until gamepad connected
const devices = {}

// Add listener for gamepad to be connected
var GAMEPAD_INDEX
var VELOCITY_THRESHOLD = 0.03
window.addEventListener("gamepadconnected", (e) => {
    const gp = navigator.getGamepads()[e.gamepad.index]
    console.log(
      "Gamepad connected at index %d: %s. %d buttons, %d axes.",
      gp.index,
      gp.id,
      gp.buttons.length,
      gp.axes.length
    )

    GAMEPAD_INDEX = gp.index
    makeDevices()
})

// Expose when grasp is active
export var graspControlActive = false

// Count frames for controller notification
let counter = 0
let notif_frame = -1


/* MAIN CONTROL UPDATE */

export default function updateControls() {
    counter++

    const gamepad_notif = document.getElementById("gamepad-connected")
    gamepad_notif.style.display = "none"
    document.getElementById("gamepad-warning").style.display = "block"

    // Try to get gamepad
    const gamepad = getGamepad()
    if(!gamepad) {
        notif_frame = -1
        return
    }

    // Handle gamepad notifications
    document.getElementById("gamepad-warning").style.display = "none"
    gamepad_notif.innerHTML = '"' + gamepad.id + '"' + " connected."
    gamepad_notif.style.display = "block"
    if(notif_frame === -1 ) notif_frame = counter

    if( counter - notif_frame > 60 ) {
        gamepad_notif.style.display = "none"
    }
    
    // handle end effector incremental controls
    handleIncrementalControls("End Effector")
    handleIncrementalControls("Joint")
    handleAxisControls("End Effector")
    handleAxisControls("Joint")
    handleLayerControl()
    handleGrasperControl()
    handleCameraControl()
}

// Defines limits for end effector, used by linear potentiometers
const eeLimits = {
    position: {
        x: [-7.5, 7.5],
        y: [0, 10],
        z: [-7.5, 7.5]
    },
    rotation: {
        x: [ -2*Math.PI, 0 ],
        y: [ -(Math.PI), Math.PI ],
        z: [ -(Math.PI), Math.PI ]
    }
}


/* CREATE DEVICES */

function makeDevices() {
    devices[ "Rotary Encoders" ] = makeRotaryEncoders(),
    devices[ "Buttons" ] = makeBasicDevices( mapping[ "Buttons" ], Button ),
    devices[ "Switches" ] = makeBasicDevices( mapping[ "Switches" ], Button ),
    devices[ "Potentiometers" ] = makeBasicDevices( mapping[ "Potentiometers"], Axis )
}

function makeRotaryEncoders() {
    const rotaryEncoders = {}
    
    const rotaryEncoderMappings = mapping[ "Rotary Encoders" ]
    for( let rotaryEncoderName in rotaryEncoderMappings ) {
        const rotaryEncoderMapping = rotaryEncoderMappings[ rotaryEncoderName ]
        const buttons = rotaryEncoderMapping[ "Buttons" ]

        // Get the IDs of all buttons
        const bId = []
        for(let buttonName in buttons ) {
            bId.push(buttons[ buttonName ])
        }

        const axis = rotaryEncoderMapping[ "velocity axis" ]
        const rotaryEncoder = new RotaryEncoder( GAMEPAD_INDEX, bId[0], bId[1], bId[2], axis)
        rotaryEncoders[ rotaryEncoderName ] = rotaryEncoder
    }

    return rotaryEncoders
}

// basic devices are buttons, switches, and potentiometers
function makeBasicDevices( deviceMappings, DeviceClass ) {
    const devices = {}

    for( let deviceName in deviceMappings ) {
        const deviceIndex = deviceMappings[ deviceName ]
        const device = new DeviceClass( GAMEPAD_INDEX, deviceIndex )
        devices[ deviceName ] = device
    }

    return devices
}


/* HANDLE CAMERA CONTROL */

function handleCameraControl() {
    const deviceName = currentControls["Pan Camera"]
    if(deviceName === "none") return
    const device = getAxis( deviceName )
    
    if( deviceName.includes("Potentiometer") ) handleCamPotentiometer( device )
    else handleCamRotaryEncoder( device )
}

function handleCamPotentiometer( device ) {
    const input = mapInput( -1, 1, -1 * device.value )
    const output = mapOutput( cameraLimits[0], cameraLimits[1], input)
    setCameraAngle( output )
}

let prevDirection 
function handleCamRotaryEncoder( device ) {
    const velocity = -1 * device.velocity
    const direction = -1 * device.direction
    const controlType = "camera"
    const ID = "n/a"

    if(Math.abs(velocity) < VELOCITY_THRESHOLD) {
        incrementOnce( controlType, ID, 1, direction === 1)
        incrementOnce( controlType, ID, -1, direction === -1)

        return
    }

    moveCameraAmt( velocity / Math.PI )
}


/* HANDLE GRASPER CONTROL */

function handleGrasperControl() {
    const controlName = currentControls["Grasp"]
    if( controlName === "none" ) return

    const device = getButton( controlName )
    
    if(controlName.includes("Switch")) {
        handleGraspSwitch( device )
    } else {
        handleGraspButton( device )
    }
}

function handleGraspSwitch( device ) {
    graspControlActive = device.pressed
}

let prevGraspButtonState
function handleGraspButton( device ) {
    if(device.pressed) {
        if(prevGraspButtonState === false || prevGraspButtonState === undefined ) {
            // Toggle grasping
            if(graspControlActive === false) graspControlActive = true
            else graspControlActive = false
        }
    }
    prevGraspButtonState = device.pressed
}


/* HANDLE LAYER CONTROL */

function handleLayerControl() {
    const controlName = controls["Layer Toggle"]
    if( controlName === "none" ) return

    const device = getButton( controlName )
    
    if(controlName.includes("Switch")) {
        handleLayerSwitch( device )
    } else {
        handleLayerButton( device )
    }
}

let prevLayerButtonState
function handleLayerButton( device ) {
    if(device.pressed) {
        if(prevLayerButtonState === false || prevLayerButtonState === undefined) {
            toggleLayer()
        }
    }
    prevLayerButtonState = device.pressed
}

let prevLayerSwitchState
function handleLayerSwitch( device ) {
    const switchSwitched = device.pressed
    if(switchSwitched) {
        if( prevLayerSwitchState === false || prevLayerSwitchState === undefined) {
            setCurrentLayer( 1 )
        }
    } else {
        if( prevLayerSwitchState === true || prevLayerSwitchState === undefined) {
            setCurrentLayer( 2 )
        }
    }
    prevLayerSwitchState = switchSwitched
}


/* HANDLE AXIS CONTROLS */

function handleAxisControls( mode ) {
    var controlTerm
    if(mode === "End Effector") controlTerm = "Axis"
    else controlTerm = "Angle"
    const axisControls = currentControls[ mode + " Controls"][controlTerm + " Controls"]
    for(let controlName in axisControls) {
        const axisName = axisControls[controlName]
        if(typeof(axisName) !== "string") continue

        var controlType = mode.toLowerCase()
        if( controlName.includes("position")) controlType += " position"
        else if( controlName.includes("rotation")) controlType += " rotation"

        handleAxisControl( controlType, controlName, axisName )
    }
}

function handleAxisControl( controlType, controlName, axisName ) {
    if(axisName === "none") return
    const device = getAxis( axisName )
    var rotaryEncoder = false
    if(axisName.includes("Rotary Encoder")) rotaryEncoder = true

    // determine the ID of the joint/axis to control
    var ID
    if( controlType.includes("end effector") ) {
        ID = controlName[0].toLowerCase()
    } else {
        const nameArray = controlName.split(" ")
        ID = nameArray[1]
    }

    // apply output appropriately
    if(rotaryEncoder) {
        setAxisRotaryEncoder( controlType, ID, device)
    } else {
        setAxisPotentiometer( controlType, ID, device)
    }


}

// Controls an axis using a rotary encoder
function setAxisRotaryEncoder( controlType, ID, encoder ) {
    let velocity = encoder.velocity
    const direction = encoder.direction

    if (Math.abs(velocity) < VELOCITY_THRESHOLD) {
        // try to increment in each direction
        incrementOnce( controlType, ID, 1, direction === 1)
        incrementOnce( controlType, ID, -1, direction === -1)
    } else {
        incrementAmt( controlType, ID, velocity )
    }
}

function setAxisPotentiometer( controlType, ID, potentiometer ) {
    const input = potentiometer.value

    if(controlType === "joint") {
        const angleRad = propInputToJointOutput( ID, input )
        robotController.setJointAngle( ID, angleRad )
    } else if (controlType === "end effector position") {
        const position = propInputToEEOutput( "position", ID, input )
        robotController.setPosition( ID, position )
    } else if (controlType === "end effector rotation") {
        const rotation = propInputToEEOutput ( "rotation", ID, input )
        robotController.setRotation( ID, rotation )
    }
}

// Returns properly scaled output for end effector based on arbitrary end
// effector limits
function propInputToEEOutput( mode, axis, input ) {
    const inputProp = mapInput( -1, 1, input)
    const limits = eeLimits[mode][axis]
    const min = limits[0]
    const max = limits[1]
    return mapOutput( min, max, inputProp)
}

// Returns properly scaled output for a joint based on joint limits
function propInputToJointOutput( jointNumber, input ) {
    const inputProp = mapInput( -1, 1, input)
    const jointLimits = storeManager.getStore("Robot").getState().jointLimits
    const jID = "J" + jointNumber
    const limits = jointLimits[ jID ]
    const min = limits[0]
    const max = limits[1]
    
    return mapOutput( min, max, inputProp)
}

// Maps value between 0 and 1 to value between min and max
function mapOutput( min, max, input) {
    const diff = max - min
    return input * diff + min
}

// Maps value between min and max to between 0 and 1
function mapInput( min, max, input ) {
    const diff = max - min
    return (input - min) / diff
}

// Handle incremental controls
function incrementAmt ( controlType, ID, amt ) {
    if( controlType === "joint" ) {
        robotController.moveJointAmt( ID, amt )
    } else if( controlType === "end effector position" ) {
        robotController.moveAlongAxisAmt( ID, amt )
    } else if( controlType === "end effector rotation") {
        robotController.rotateAroundAxisAmt( ID, amt )
    } else {
        console.error("Invalid control type")
    }
}


/* HANDLE CONTROLS INCREMENTAL */

function handleIncrementalControls( mode ) {
    const incrementalControls = currentControls[ mode + " Controls"]["Incremental Controls"]
    for(let controlName in incrementalControls) {
        // handle step size control
        if(controlName.includes("step size")) {
            const newStep = incrementalControls[controlName]
            handleStepSize( mode, newStep )
            continue
        }

        const buttonName = incrementalControls[controlName]
        if(typeof(buttonName) !== "string") continue

        // handle other controls
        var controlType = mode.toLowerCase()
        if( controlName.includes("position")) controlType += " position"
        else if( controlName.includes("position")) controlType += " rotation"

        handleIncrementalControl( controlType, controlName, buttonName )
    }
}

function handleStepSize( mode, newStep ) {
    var currentStep

    if(mode === "Joint") currentStep = robotController.rotStep
    else if (mode === "End Effector") currentStep = robotController.transStep
    else {
        console.error("Invalid mode")
    }

    if( currentStep === newStep ) return

    if( mode === "Joint" ) robotController.setRotStepDeg( newStep )
    else robotController.setTransStep( newStep )


}

// Store incremental controls so they can be issued only once per button press
const incrementalControlStates = {}

function handleIncrementalControl( controlType, controlName, buttonName ) {
    if( buttonName === "none" ) return
    const button = getButton( buttonName )

    // determine direction
    var direction = 0
    if( controlName.includes("increment") ) direction = 1
    else if ( controlName.includes("decrement" )) direction = -1
    else {
        console.warn( "Invalid control name" )
        return
    }

    // determine id
    const nameArray = controlName.split(" ")
    var ID

    if( controlType === "joint" ) ID = nameArray[2]
    else if ( controlType.includes("end effector")) ID = nameArray[1].toLowerCase()
    else {
        console.warn( "Invalid control type" )
        return
    }

    incrementOnce( controlType, ID, direction, button.pressed)
}

// increment once and don't increment again until button is unpressed
function incrementOnce( controlType, ID, direction, buttonPressed ) {
    var directionWord = "increment"
    if(direction === -1) directionWord = "decrement"

    const controlName = directionWord + " " + controlType + " " + ID

    if( buttonPressed ) {
        if(incrementalControlStates[controlName] !== false) return
        
        increment( controlType, ID, direction )
        incrementalControlStates[controlName] = true
    } else {
        incrementalControlStates[controlName] = false
    }
} 

// helpers for selecting correct control function
function increment( controlType, ID, direction ) {
    if( controlType === "joint" ) {
        robotController.moveJoint( ID, direction )
    } else if( controlType === "end effector position" ) {
        robotController.moveAlongAxis( ID, direction )
    } else if( controlType === "end effector rotation") {
        robotController.rotateAroundAxis( ID, direction )
    } else if( controlType === "camera") {
        moveCamera( direction )
    } else {
        console.error("Invalid control type")
    }
}


/* HELPER FUNCTIONS */

function getButton( buttonName ) {
    if( buttonName.includes( "Rotary Encoder" )) {
        // Rotary Encoder name format: "Rotary Encoder # button name"
        var nameArray = buttonName.split(" ")
        const num = nameArray[2]
        const encoderName = "Rotary Encoder " + num
        buttonName = nameArray[3]
        
        return devices["Rotary Encoders"][encoderName].buttons[buttonName]
    } else if ( buttonName.includes( "Switch" )) {
        return devices["Switches"][buttonName]
    } else {
        return devices["Buttons"][buttonName]
    }
}

function getAxis( axisName ) {
    if( axisName.includes( "Rotary Encoder" )) {
        return devices["Rotary Encoders"][axisName]
    } else if ( axisName.includes( "Potentiometer" )) {
        return devices["Potentiometers"][axisName]
    } else {
        console.error("Invalid axis name")
    }
}

function getGamepad() {
    const gamepads = navigator.getGamepads()
    if(!gamepads) return

    const gamepad = gamepads[0]
    let buttons
    try {
        buttons = gamepad.buttons
    } catch ( err ) {
        return false
    }

    return gamepad
}
