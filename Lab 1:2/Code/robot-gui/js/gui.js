import initialControls from "../config/controls.json" assert { type: "json" }
import mapping from "../config/mapping.json" assert { type: "json" }
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'


// Make a deep copy of each control config so we can reset them later
export var controls = JSON.parse(JSON.stringify(initialControls))
var editControls = JSON.parse(JSON.stringify(controls[ "Controls Layer 1" ]))
export var currentControls = JSON.parse(JSON.stringify(controls[ "Controls Layer 1" ]))

// Track layer state
let layer = {
    current: 1,
    edit: 1
}

const layerInfo = document.getElementById("layer-info")


/* CREATE GUI */

export const gui = new GUI({width: 400})
gui.close()
gui.hide()

// layer controls
const layerControlFolder = gui.addFolder( "Layer Controls")
const layerDropdown = layerControlFolder.add( layer, "edit", {"Layer 1": 1, "Layer 2": 2}).name("Edit Layer")
layerDropdown.onChange(function () {
    setEditLayer( layer.edit )
    updateGUI()
})

// META!! controls for the controls
let controlControls = {
    "Download Controls Config": downloadControlsConfig,
    "Upload Controls Config": uploadControlsConfig,
    "Reset Controls": resetControls,
    "Reset Layer": resetEditLayer,
    "Copy Controls From Layer 1": () => duplicateLayer(1),
    "Copy Controls From Layer 2": () => duplicateLayer(2)
}

// Create layer toggle control
const binaryControlList = getBinaryControlNames( mapping )
binaryControlList.unshift("none")
layerControlFolder.add(controls, "Layer Toggle", binaryControlList)
layerControlFolder.add(controlControls, "Reset Layer")

// Button for duplicating layers
const duplicateLayerOne = layerControlFolder.add( controlControls, "Copy Controls From Layer 1")
const duplicateLayerTwo = layerControlFolder.add( controlControls, "Copy Controls From Layer 2")
duplicateLayerOne.hide()

// Create folders for robot controls
const guiFolders = addFolders( editControls, gui)
createControls()

// Add file IO controls
gui.add(controlControls, "Download Controls Config")
gui.add(controlControls, "Upload Controls Config")
gui.add(controlControls, "Reset Controls")

// Update controls when they change
gui.onChange(event => {
    const controllerName = event.controller._name

    // Don't update layer when layer dropdown switched, otherwise one layer is copied to other
    if(controllerName !== layerDropdown._name) {
        updateControls(controls[ "Controls Layer " + layer.edit ], editControls)
        
        // if we are editing the current layer, update the controls
        if(layer.current === layer.edit) {
            updateControls(currentControls, controls[ "Controls Layer " + layer.current])
        }
    }
})


/* GUI CREATION FUNCTIONS */

function createControls() {
    createIncrementalControls()
    createAxisControls()

    //Add gripper controls
    const binaryList = getBinaryControlNames( mapping )
    binaryList.unshift("none")
    gui.add(editControls, "Grasp", binaryList)
}

// Create all the incremental controls
function createIncrementalControls() {
    const buttonList = getButtonNames( mapping )
    buttonList.unshift("none")

    // Create end effector incremental controls
    addControlsToGUI( 
        guiFolders["End Effector Controls"]["Incremental Controls"].folder,
        editControls["End Effector Controls"]["Incremental Controls"],
        buttonList
    )

    // Create joint level incremental controls
    addControlsToGUI( 
        guiFolders["Joint Controls"]["Incremental Controls"].folder,
        editControls["Joint Controls"]["Incremental Controls"],
        buttonList
    )
}

function createAxisControls() {
    const axisList = getAxisNames( mapping )    
    axisList.unshift("none")

    // End effector axis controls
    addControlsToGUI(
        guiFolders["End Effector Controls"]["Axis Controls"].folder,
        editControls["End Effector Controls"]["Axis Controls"],
        axisList
    )

    // Joint axis controls
    addControlsToGUI(
        guiFolders["Joint Controls"]["Angle Controls"].folder,
        editControls["Joint Controls"]["Angle Controls"],
        axisList
    )

    gui.add(editControls, "Pan Camera", axisList)
}


/* HELPER FUNCTIONS */

// Recursively add all subobjects in an object as gui folders
// Returns an object containing all the gui folder objects
function addFolders( object, gui ){
    const folders = {}
    for(let folderName in object) {
        const folder = object[ folderName ]
        if( typeof(folder) !== "object" ) continue

        var guiFolder
        if( folderName === "Axis Controls" || folderName === "Angle Controls" ) {
            guiFolder = gui.addFolder( "Continuous Controls" )
        } else if ( folderName === "Incremental Controls" ) {
            guiFolder = gui.addFolder( "Discrete Controls" )
        } else {
            guiFolder = gui.addFolder( folderName )
        }

        folders[ folderName ] = addFolders( folder, guiFolder )
        folders[ folderName ][ "folder" ] = guiFolder

        guiFolder.close()
    }
    
    return folders
}

// Functions to get device names
function getButtonNames( mapping ) {
    let buttonNames = Object.keys(mapping["Buttons"])

    for(let rotaryEncoderName in mapping["Rotary Encoders"]) {
        const name = rotaryEncoderName + " button"
        buttonNames.push(name)
    }

    return buttonNames
}

function getAxisNames( mapping ) {
    let axisNames = Object.keys(mapping["Rotary Encoders"])
    axisNames = axisNames.concat(Object.keys(mapping["Potentiometers"]))
    
    return axisNames
}

function getBinaryControlNames( mapping ) {
    let binaryControlNames = getButtonNames( mapping )
    binaryControlNames = binaryControlNames.concat(Object.keys( mapping["Switches"] ))

    return binaryControlNames
}

/*
Adds all controls from the controls object to the gui folder
Allows user to select device from the device names pass in
Any controls that are not defined by strings (controls that are not devices)
are not created with a dropdown
*/
function addControlsToGUI( guiFolder, controls, deviceNames ) {
    for(let controlName in controls) {
        if(typeof(controls[controlName]) !== "string") {
            guiFolder.add( controls, controlName )
            continue
        }

        guiFolder.add( controls, controlName, deviceNames )
    }
}

// Download the controls
function downloadControlsConfig() {
    const filename = "controls.json"
    const jsonStr = JSON.stringify(controls)

    // Code to download file automatically
    // Source: https://stackoverflow.com/a/30800715
    let element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonStr))
    element.setAttribute('download', filename)

    element.style.display = 'none'
    document.body.appendChild(element)

    element.click()

    document.body.removeChild(element)
}

// Prompt user to upload a controls config and set the controls to it
function uploadControlsConfig() {
    // Source: https://stackoverflow.com/a/40971885
    var input = document.createElement('input')
    input.type = 'file'

    input.onchange = e => { 
        // getting a hold of the file reference
        var file = e.target.files[0]; 

        // setting up the reader
        var reader = new FileReader()
        reader.readAsText(file,'UTF-8')

        // here we tell the reader what to do when it's done reading...
        reader.onload = readerEvent => {
            var content = readerEvent.target.result; // this is the content!
            const newControls = JSON.parse(content)
            updateControls( controls, newControls )
            updateActiveLayers()
            updateGUI()
        }
    }

    input.click()
}


// Function to manage all the controls

function resetControls() {
    updateControls( controls, initialControls )
    updateActiveLayers()
    updateGUI()
}


// Updates display of all GUI elements
function updateGUI() {
    const guiControllers = gui.controllersRecursive()
    for( let controller of guiControllers ) {
        controller.updateDisplay()
    }
}

// Have to update controls recursively so that GUI updates
function updateControls(oldControls, newControls) {
    for(let controlName in oldControls) {
        if(typeof(oldControls[controlName]) === "object") {
            updateControls( oldControls[controlName], newControls[controlName] )
            continue
        }

        if(oldControls[controlName] !== newControls[controlName]) {
            oldControls[controlName] = newControls[controlName]
        }
    }
}

function updateActiveLayers() {
    updateControls( editControls, controls[ "Controls Layer " + layer.edit ])
    updateControls( currentControls, controls[ "Controls Layer " + layer.current ])
}

function resetEditLayer() {
    updateControls( controls[ "Controls Layer " + layer.edit ], 
                    initialControls[ "Controls Layer " + layer.edit])
    updateActiveLayers()
    updateGUI()
}

function duplicateLayer( num ) {
    if(num === 1) {
        updateControls( controls[ "Controls Layer 2"], controls[ "Controls Layer 1"] )
    } else if (num === 2) {
        updateControls( controls[ "Controls Layer 1"], controls[ "Controls Layer 2"] )
    }

    updateActiveLayers()
    updateGUI()
}

function setEditLayer( layerNum ) {
    layer.edit = layerNum
    updateControls( editControls, controls[ "Controls Layer " + layerNum ])
    updateGUI()

    if(layerNum === 1) {
        duplicateLayerOne.hide()
        duplicateLayerTwo.show()
    } else if (layerNum === 2) {
        duplicateLayerOne.show()
        duplicateLayerTwo.hide()
    }
}

export function setCurrentLayer( layerNum ) {
    layer.current = layerNum
    layerInfo.innerHTML = "Layer " + layerNum
    updateControls( currentControls, controls[ "Controls Layer " + layerNum ] )
}

export function toggleLayer() {
    if(layer.current === 1) {
        setCurrentLayer(2)
    } else {
        setCurrentLayer(1)
    }
}