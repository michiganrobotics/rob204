import * as THREE from 'three'

import { scene } from './scene'
import { manager } from "./scene"
import { updateCamera } from "./camera"
import { robotEEIntersecting, robotIntersecting, robotStore, updateRobot } from "./RobotTHREE"
import updateControls, { graspControlActive } from "./gamepad"
import { TargetBox } from "./targetBox"
import { robotEEOrientation } from './RobotTHREE'
import { robotInvalid } from './Robot'
import { robotController } from './RobotEEControl'
import { gui as controlGUI } from './gui'

import goalPositions from "../config/goal_positions.json" assert { type: "json" }
import colors from '../config/colors'

// Game constants
const SCORE_COOLDOWN_SECONDS = 2
const DAMAGE_COOLDOWN_SECONDS = 1
const TIME_TRIAL_LENGTH_SECONDS = 180
const TIME_TRIAL_WARN_SECONDS = 30

// Store game objects
let targets = []
let goals = []
let goalTimers = []

// Store user's score
let score = 0

// Create game objects
createGoal(
    new THREE.Vector3(1, 2, 3),
    new THREE.Vector3(0, 0, 0),
    colors.goals.goal_1.default,
    colors.goals.goal_1.darkened
)

createGoal(
    new THREE.Vector3(4, 2, 3),
    new THREE.Vector3(0, 0, 0),
    colors.goals.goal_2.default,
    colors.goals.goal_2.darkened
)

createGoal(
    new THREE.Vector3(4, 7, 3),
    new THREE.Vector3(0, 0, 0),
    colors.goals.goal_3.default,
    colors.goals.goal_3.darkened
)

createTarget(
    new THREE.Vector3(2, 5, 1),
    new THREE.Vector3(0, 0, 0),
    colors.goals.goal_1.default
)

// Start animating when loading is finished
const progressBarContainer = document.querySelector('.progress-bar-container')
manager.onLoad = function ( ) {
    animate()
}

// Add keyboard override for grasping
var graspOverride = false
window.addEventListener("keydown", (e) => {
    if(e.key === "G") {
        graspOverride = !graspOverride
    }
})

// Variables to track timing
const scoreDisplay = document.getElementById("score")
let counter = 0
let startUpdatingArm = false
let damageFrames = []

// Setup time trial clock
const timerDisplay = document.getElementById("timer")
setClock( TIME_TRIAL_LENGTH_SECONDS )
let timerSeconds = TIME_TRIAL_LENGTH_SECONDS
let timeTrial = false
let start

// Set up time trial controls
const startButton = document.getElementById('start-button')
const endButton = document.getElementById('end-button')
startButton.onclick = beginTimeTrial
endButton.onclick = endTimeTrial


/* ANIMATION LOOP */

export function animate() {
    // Handle keyboard override for grasping
    var grasping = graspControlActive
    if( graspOverride ) grasping = true

    // wait for objects to fully load
    counter++
    if(counter === 2) {
        progressBarContainer.style.display = 'none'
        showGUI()
        startUpdatingArm = true
    }
    if( startUpdatingArm ) robotController.goToGoal()

    // update score display
    scoreDisplay.innerHTML = "Score: " + score

    // update time trial timer
    if( timeTrial ) {
        let delta = Date.now() - start
        let deltaSeconds = Math.floor(delta / 1000)
        timerSeconds = TIME_TRIAL_LENGTH_SECONDS - deltaSeconds
        if( timerSeconds <= 0 ) endTimeTrial()

        setClock( timerSeconds )
    }

    // update each target
    for(let i = 0; i < targets.length; i++) {
        const target = targets[i]
        const damage = robotIntersecting( target.mesh.userData.obb )

        // Track arm state
        const armInRange = robotEEIntersecting( target.attachmentPointBound )
        const armTargetDot = robotEEOrientation.dot( target.orientation )
        const armAligned = Math.abs( armTargetDot + 1 ) < 0.02

        // Indicate arm state
        updateTargetColors(target, armInRange, armAligned, grasping, damage )

        // Make damage display flash
        if(damageFrames[i] === undefined || counter - damageFrames[i] > 10) {
            updateTargetColors(target, armInRange, armAligned, grasping, false )
        }

        // Handle damage to target, update score
        if(damage && (!armInRange || !armAligned)) {
            if(damageFrames[i] === undefined || counter - damageFrames[i] > DAMAGE_COOLDOWN_SECONDS * 60) {
                damageFrames[i] = counter
                if( timeTrial ) score -= 1
                target.setBorderColor( colors.target.border.damage )
            }
        }

        // Handle arm grasping target
        if( armInRange && armAligned && grasping ) {
            const robotTarget = robotStore.getState().target
            if(!robotInvalid) target.attach( robotTarget.position, robotTarget.rotation )
        }

        // Handle each goal
        for(let i = 0; i < goals.length; i++) {
            const goal = goals[i]
            // Make sure target color matches goal color
            if(goal.borderColor !== target.color) continue

            // Check if box has been placed
            if(!grasping && goalTimers[i] > SCORE_COOLDOWN_SECONDS) {
                const goal = getRandomGoal()
                target.transform( goal.position, goal.rotation )
                target.setColor( getRandomColorRGB() )
                if( timeTrial ) score += 10
            }

            // Update cooldown border if target is in goal
            if(grasping && goal.boundingBox.containsBox(target.boundingBox)) {
                goalTimers[i] += 1/60

                goal.setProgressBorderProp( goalTimers[i] / SCORE_COOLDOWN_SECONDS)
            } else {
                goalTimers[i] = 0
                goal.setProgressBorderProp(0)
            }
        }
    }

    // Call other update functions
    updateRobot()
    updateControls()
    updateCamera()

    // Animate at 60 frames per second
    setTimeout( function() {

        requestAnimationFrame( animate )

    }, 1000 / 60 )
}


/* HELPER FUNCTIONS */

// Randomization
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min
}

function getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min) + min); 
    // The maximum is exclusive and the minimum is inclusive
}

function getRandomGoal() {
    let i = getRandomInt(0, goalPositions.length)
    return goalPositions[i]
}

function getRandomColorRGB() {
    const goalNames = Object.keys(colors.goals)
    const int = getRandomInt(0, 3)
    const goalName = goalNames[ int ]

    return colors.goals[ goalName ].default
}

// Functions for creating game objects
function createTarget( position, rotation, color ) {
    const target = new TargetBox(position, rotation, scene)
    target.setBorderColor( colors.target.border.default )
    target.setColor( color )

    targets.push( target )
}

function createGoal( position, rotation, color, progressColor ) {
    const goal = new TargetBox(position, rotation, scene, {x: 2, y: 3, z: 2})
    goal.setBorderColor( color )
    goal.hideMesh()
    goal.hideAttachmentPoint()
    goal.addProgressBorder()
    goal.setProgressBorderProp( 0 )
    goal.progressBorder.material.color = new THREE.Color( progressColor )

    goals.push(goal)
    goalTimers.push(0)
}

// Handle target interactions
function updateTargetColors( target, armInRange, armAligned, grasping, damage ) {

    // Handle attachment point colors
    let attachmentPointColor = colors.target.attachment_point.default
    if(armAligned) attachmentPointColor = colors.target.attachment_point.aligned

    // Handle border of target
    if(armInRange && armAligned) {
        if(grasping) attachmentPointColor = colors.target.attachment_point.attached
        target.setBorderColor( colors.target.border.ready_to_attach )
    } else if (damage) {
        target.setBorderColor( colors.target.border.damage )
    } else {
        target.setBorderColor( colors.target.border.default )
    }

    target.setAttachmentPointColor(attachmentPointColor)
}


// Handle time trial controls
function setClock( seconds ) {
    let tMin = Math.floor( seconds / 60 )
    let tSec = Math.floor( seconds % 60 )
    if( tSec < 10 ) tSec = "0" + tSec
    let time = tMin + ":" + tSec
    timerDisplay.innerHTML = time
    if( seconds <= TIME_TRIAL_WARN_SECONDS ) timerDisplay.style.color = "red"
}

function showGUI() {
    const gui = document.getElementsByClassName("initial-gui")
    for(let i = 0; i < gui.length; i++) {
        gui[i].style.display = "block"
    }
    controlGUI.show()
}

function beginTimeTrial() {
    for(const target of targets) {
        const goal = getRandomGoal()
        target.transform( goal.position, goal.rotation )
        target.setColor( getRandomColorRGB() )
    }
    endButton.style.display = "inline"
    startButton.style.display = "none"
    scoreDisplay.style.display = "inline"
    score = 0
    timeTrial = true
    start = Date.now()
    controlGUI.hide()
}

function endTimeTrial() {
    endButton.style.display = "none"
    startButton.style.display = "inline"
    // scoreDisplay.style.display = "none"
    timeTrial = false
    timerSeconds = TIME_TRIAL_LENGTH_SECONDS
    timerDisplay.style.color = "white"
    setClock(timerSeconds)
    controlGUI.show()
}