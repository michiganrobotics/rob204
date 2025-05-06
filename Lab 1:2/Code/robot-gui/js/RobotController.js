import { robotInvalid } from "./Robot"

// THREE.js coordinate units per frame
const MAX_TRANS_VEL = 0.16 
const MAX_ROT_VEL = 0.1

export class RobotController {
    static DEG_TO_RAD = Math.PI / 180
    constructor(robotStore, transStep = 0.25, rotStep = (Math.PI)/36) {
        // Allows us to get and set robot state
        this.robotStore = robotStore
        
        // Robot current state
        this.angles = robotStore.getState().angles
        this.eePosition = robotStore.getState().target.position
        this.eeRotation = robotStore.getState().target.rotation
    
        // How much to move by
        this.rotStep = rotStep
        this.transStep = transStep

        this.positionGoal = { x: 0, y: 7, z: 1 }
        this.rotationGoal = { x: -Math.PI, y: 0, z: 0 }
        this.angleGoal = { A0: Math.PI / 2, A1: 0, A2: 0, A3: 0, A4: 0, A5: 0 }

        this.goToAngleGoal = false
        this.atRotationGoal = false
        this.atPositionGoal = false
        this.atAngleGoal = true
    }

    setTransStep( step ) {
        this.transStep = step
    }

    setRotStepDeg( angleDeg ) {
        this.rotStep = angleDeg * RobotController.DEG_TO_RAD
    }

    setJointAngle( jointNumber, angleRad ) {
        this.angleGoal[ "A" + jointNumber ] = angleRad
    }

    setPosition( axis, position ) {
        this.positionGoal[ axis ] = position
        // this.#setTweenTarget( this.EEposition, this.EErotation )
    }

    setRotation( axis, rotation ) {
        this.rotationGoal[ axis ] = rotation
    }

    incrementJoint( jointNumber ) { this.moveJoint( jointNumber, 1 ) }
    decrementJoint( jointNumber ) { this.moveJoint( jointNumber, -1 ) }
    incrementPosition( axis ) { this.moveAlongAxis( axis, 1 ) }
    decrementPosition( axis ) { this.moveAlongAxis( axis, -1 ) }
    incrementRotation( axis ) { this.rotateAroundAxis( axis, 1 ) }
    decrementRotation( axis ) { this.rotateAroundAxis( axis, -1 ) }

    moveJoint( jointNumber, direction ) {
        const step = this.rotStep * direction
        this.moveJointAmt( jointNumber, step )
    }

    moveJointAmt( jointNumber, amt ) {
        this.angleGoal[ "A" + jointNumber ] += amt
    }

    moveAlongAxis( axis, direction ) {
        const step = this.transStep * direction
        this.moveAlongAxisAmt( axis, step )
    }

    rotateAroundAxis( axis, direction ) {
        const step = this.rotStep * direction
        this.rotateAroundAxisAmt( axis, step )
    }

    moveAlongAxisAmt( axis, amt ) {
        this.positionGoal[ axis ] += amt
    }

    rotateAroundAxisAmt( axis, amt ) {
        this.rotationGoal[ axis ] += amt
    }

    #updateState() {
        Object.assign(this.angles, this.robotStore.getState().angles)
        Object.assign(this.eePosition, this.robotStore.getState().target.position)
        Object.assign(this.eeRotation, this.robotStore.getState().target.rotation)
    }

    // runs periodically to move robot to goal state
    goToGoal() {
        this.calcAtGoals()

        if(!this.atPositionGoal || !this.atRotationGoal) {
            this.tweenEndEffector( this.eeRotation, this.rotationGoal, MAX_ROT_VEL )
            this.tweenEndEffector( this.eePosition, this.positionGoal, MAX_TRANS_VEL )
            this.#setRobotTarget(this.eePosition, this.eeRotation)
            Object.assign( this.angleGoal, this.angles ) 

            if(robotInvalid) {
                Object.assign(this.positionGoal, this.eePosition)
                Object.assign( this.rotationGoal, this.eeRotation )
            }
        }

        if(!this.atAngleGoal) {
            this.tweenJoints( this.angles, this.angleGoal, MAX_ROT_VEL / 2 )
            this.#setRobotAngles( this.angles )
            Object.assign( this.positionGoal, this.eePosition )
            Object.assign( this.rotationGoal, this.eeRotation )

            if(robotInvalid) {
                Object.assign( this.angleGoal, this.angles )
            }
        }
    }

    tweenEndEffector( state, goal, max_vel ) {
        let totalDiff = 0
        let diffs = { x: 0, y: 0, z: 0 }
        for( let axisName in goal ) {
            const goalAxis = goal[ axisName ]
            const eeAxis = state[ axisName ]
            let diff = goalAxis - eeAxis

            diffs[ axisName ] = diff
            totalDiff += Math.abs( diff )
        }   

        for( let axisName in goal ) {
            const goalAxis = goal[ axisName ]
            const diff = diffs[ axisName ]
            let prop = 1
            if (totalDiff !== 0) prop = Math.abs( diff / totalDiff )
            const propVel = max_vel * prop

            if( Math.abs( diff ) < propVel ) {
                state[ axisName ] = goalAxis
                continue
            } 

            const increment = propVel * Math.sign( diff )
            const nextState = incrementDictVal( state, axisName, increment )
            Object.assign( state, nextState )
        }
    }

    tweenJoints( state, goal, max_vel ) {

        for( let axisName in goal ) {
            const goalAxis = goal[ axisName ]
            const eeAxis = state[ axisName ]
            const diff = goalAxis - eeAxis

            if( Math.abs( diff ) < max_vel ) {
                state[ axisName ] = goalAxis
                continue
            }

            const increment = max_vel * Math.sign( diff )
            const nextState = incrementDictVal( state, axisName, increment )
            Object.assign( state, nextState )
        }  
    }

    calcAtGoals() {
        this.atPositionGoal = this.atGoal( this.eePosition, this.positionGoal )
        this.atRotationGoal = this.atGoal( this.eeRotation, this.rotationGoal )
        this.atAngleGoal = this.atGoal( this.angles, this.angleGoal )
    }

    atGoal( state, goal ) {
        let there = true
        for( let axisName in goal ) {
            const goalAxis = goal[ axisName ]
            const eeAxis = state[ axisName ]
            const diff = goalAxis - eeAxis

            if( Math.abs(diff) > 0.02 ) there = false
        } 

        return there
    }

    #setRobotTarget( position, rotation ) {
        this.robotStore.dispatch('ROBOT_CHANGE_TARGET', { position, rotation })
        this.#updateState()
    }

    #setRobotAngles( angles ) {
        this.robotStore.dispatch('ROBOT_CHANGE_ANGLES', angles)
        this.#updateState()
    }
}

// Increment copy the dictionary and increment the given value
function incrementDictVal( dict, key, amount ) {
    var dictCopy = {}
    Object.assign( dictCopy, dict )
    dictCopy[ key ] += amount
    return dictCopy
}