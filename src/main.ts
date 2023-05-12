import { Client, BoardClient, MotionClient, ArmClient, createRobotClient, StreamClient } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';

// globals
const robotSecret = process.env.VIAM_SECRET
const robotLocation = process.env.VIAM_LOCATION
const grabberPin = '8'
const moveDistance = 20
const ignoreInterrupts = true
const moveHeight = 500
const gridSize = 3
const reachMm = 560
// if we mount the arm straight we don't need this
const offset = 90
const quadrantSize = (reachMm*2)/gridSize

const myResourceName: ResourceName = {
  namespace: 'rdk', 
  type: 'component', 
  subtype: 'arm', 
  name: 'myArm' 
}

/*
  Create obstacles
*/
const holeObject: SDK.Geometry = {
  center: {
    x: 470, 
    y: 120, 
    z: 0, 
    oX: 0, 
    oY: 0, 
    oZ: 1, 
    theta: 15
  }, 
  box: {
    dimsMm: {
      x: 260, 
      y: 360, 
      z: 140
    }
  }, 
  label: ""
}

let frontWallObject: SDK.Geometry ={
  center: {
    x: reachMm,
    y: 0,
    z: 0,
    theta: 15,
    oX: 0,
    oY: 0,
    oZ: 1,
  }, 
  box: {
    dimsMm: {
      x: 15, 
      y: 2000, 
      z: 1000
    }
  },
  label: '',
}

let backWallObject: SDK.Geometry ={
  center: {
    x: reachMm,
    y: 0,
    z: 0,
    theta: 15,
    oX: 0,
    oY: 0,
    oZ: 1,
  }, 
  box: {
    dimsMm: {
      x: 15, 
      y: 2000, 
      z: 1000
    }
  },
  label: '',
}

let rightWallObject: SDK.Geometry ={
  center: {
    x: 0,
    y: 700,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: 1,
  }, 
  box: {
    dimsMm: {
      x: 15, 
      y: 2000, 
      z: 1000
    }
  },
  label: '',
}

let leftWallObject: SDK.Geometry ={
  center: {
    x: 0,
    y: 550,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: 1,
  }, 
  box: {
    dimsMm: {
      x: 15, 
      y: 2000, 
      z: 1000
    }
  },
  label: '',
}


async function connect() {
  //This is where you will list your robot secret. You can find this information
  //in your Code Sample tab on your robot page. Check the Typescript code sample 
  //to get started. :)  
  const secret = robotSecret;
  const credential = {
    payload: secret,
    type: 'robot-location-secret',
  };

  //This is the host address of the main part of your robot.
  const host = robotLocation;

  //This is the signaling address of your robot. 
  const signalingAddress = 'https://app.viam.com:443';

  const iceServers = [{ urls: 'stun:global.stun.twilio.com:3478' }];

  return createRobotClient({
    host,
    credential,
    authEntity: host,
    signalingAddress,
    iceServers,
  });
}

function forwardbutton() {
  return <HTMLImageElement>document.getElementById('forward-button');

}

function backbutton() {
  return <HTMLImageElement>document.getElementById('back-button');
}

function rightbutton() {
  return <HTMLImageElement>document.getElementById('right-button');
}

function leftbutton() {
  return <HTMLImageElement>document.getElementById('left-button');
}

function dropbutton() {
  return <HTMLImageElement>document.getElementById('drop-button');
}

function gridBackLeft() {
  return <HTMLTableCellElement>document.getElementById('grid-back-left');
}

function gridBack() {
  return <HTMLTableCellElement>document.getElementById('grid-back');
}

function gridBackRight() {
  return <HTMLTableCellElement>document.getElementById('grid-back-right');
}

function gridLeft() {
  return <HTMLTableCellElement>document.getElementById('grid-left');
}
function gridRight() {
  return <HTMLTableCellElement>document.getElementById('grid-right');
}

function gridFrontLeft() {
  return <HTMLTableCellElement>document.getElementById('grid-front-left');
}

function gridFrontRight() {
  return <HTMLTableCellElement>document.getElementById('grid-front-right');
}

// function upbutton() {
//   return <HTMLButtonElement>document.getElementById('up-button');
// }


//Creating a delay function for timing 
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


let constraints: Constraints = {
  orientationConstraintList: [
    {orientationToleranceDegs: 5},
  ],
  linearConstraintList: [],
  collisionSpecificationList: [],
};

async function home(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a Worldstate that has the GeometriesInFrame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [holeObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  // home position - where ball should be dropped and each game starts
  let home_pose: SDK.Pose = {
    x: 390,
    y: 105,
    z: moveHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1,
  };
  
  let home_pose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: home_pose
  }

  try {       
    await motionClient.move(home_pose_in_frame, myResourceName, myWorldState, constraints)
  } finally {
    //homebutton().disabled = false;
  }
}

async function moveToQuadrant(motionClient: MotionClient, armClient: ArmClient, x: number, y: number) {
    //Create a Worldstate that has the GeometriesInFrame included 
    let myObstaclesInFrame: SDK.GeometriesInFrame = {
      referenceFrame: "world", 
      geometriesList: [frontWallObject, backWallObject, leftWallObject, rightWallObject],
    }
    
    let myWorldState: SDK.WorldState ={
      obstaclesList: [myObstaclesInFrame],
      transformsList: [],
    }
  
    let xTarget = (quadrantSize*x)
    let yTarget = (quadrantSize*y)
    let yOffset = 0
    let xOffset = 0
    if (xTarget < 0) {
      yOffset = 0 - offset
    } else if (xTarget === 0) {
      // do nothing
    } else {
      xOffset = 0 - offset
      yOffset = offset
    }
    let pose: SDK.Pose = {
      x: xTarget + xOffset,
      y: yTarget + yOffset,
      z: moveHeight,
      theta: 0,
      oX: 0,
      oY: 0,
      oZ: -1,
    };
    
    console.log(pose)

    let new_pose_in_frame: SDK.PoseInFrame ={
      referenceFrame: "world", 
      pose: pose
    }
  
    try {       
      await motionClient.move(new_pose_in_frame, myResourceName, myWorldState, constraints)
    } finally {
      //homebutton().disabled = false;
    }
}

async function forward(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a WorldState that has Geometries in Frame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [frontWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let forwardPose: Pose = {
    x: currentPosition.pose!.x + moveDistance,
    y: currentPosition.pose!.y,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0, 
    oZ: -1
  };

  let forwardPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: forwardPose
  }

  await motionClient.move(forwardPoseInFrame, myResourceName, myWorldState, constraints)
}

async function back(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a WorldState that has Geometries in Frame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [backWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let backPose: Pose = {
    x: currentPosition.pose!.x -moveDistance,
    y: currentPosition.pose!.y,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };

  let backPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: backPose
  }

  await motionClient.move(backPoseInFrame, myResourceName, myWorldState, constraints)
}

async function right(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a WorldState that has Geometries in Frame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [rightWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let rightPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y + moveDistance,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };

  let rightPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: rightPose
  }

  await motionClient.move(rightPoseInFrame, myResourceName, myWorldState, constraints)
}

async function left(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { console.log("Too fast!"); return }
  
  //Create a WorldState that has Geometries in Frame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [leftWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let leftPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y - moveDistance,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };

  let leftPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: leftPose
  }

  await motionClient.move(leftPoseInFrame, myResourceName, myWorldState, constraints)
}

async function dropDown(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a WorldState that has Geometries in Frame included 
  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [holeObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  let dropPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: 240,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: currentPosition.pose!.oZ
  };

  let dropPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: dropPose
  }

  //Drop the claw down
  console.log('im about to drop to' + JSON.stringify(dropPoseInFrame))
  await motionClient.move(dropPoseInFrame, myResourceName, myWorldState, constraints)
  console.log('dropped')

}

async function up(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  
  let upPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: moveHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: currentPosition.pose!.oZ
  };

  let upPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: upPose
  }

  //Pick the claw up 
  console.log('let`s go up')
  await motionClient.move(upPoseInFrame, myResourceName, myWorldState, constraints)
  console.log('up!')

}

async function grab(boardClient: BoardClient) {
  try {
    //grabbutton().disabled = true;

    console.log(await boardClient.getGPIO(grabberPin));
    console.log('i`m grabbin');
    await boardClient.setGPIO(grabberPin, true);
    
   
  } finally {
    //grabbutton().disabled = false;
  }
}

async function release(boardClient: BoardClient) {
  try {
   // grabbutton().disabled = true;

    console.log(await boardClient.getGPIO(grabberPin));
    await boardClient.setGPIO(grabberPin, false);
    await delay(1000);
    console.log('i let go now');
  } finally {
    //grabbutton().disabled = false;
  }
}

async function main() {
  // Connect to client
  let client: Client;  
  try {
    client = await connect();
    console.log('connected!');
  } catch (error) {
    console.log(error);
    return;
  }
  const motionClient = new MotionClient(client, 'planning:builtin');
  const boardClient = new BoardClient(client, 'myBoard');
  const armClient = new ArmClient(client, 'planning:myArm');

  // Add this function at the top of your main.ts file
  function applyErrorClass(element: HTMLElement) {
    element.classList.add("error");
  }

  // Update the onclick handlers in the main function:
  let useTouch = false;
  let isMoving = false;

  function styleMove(state) {
    let element = document.getElementById('grid-container')
    if (state === 'move') {
      element.classList.remove('grid-container-error')
      element.classList.remove('grid-container-ready')
      element.classList.add('grid-container-moving')
    } else if (state === 'ready') {
      element.classList.remove('grid-container-error')
      element.classList.remove('grid-container-moving')
      element.classList.add('grid-container-ready')
    } else if (state === 'error') {
      element.classList.remove('grid-container-moving')
      element.classList.remove('grid-container-ready')
      element.classList.add('grid-container-error')
    }
  }

  forwardbutton().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await forwardHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  forwardbutton().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    isMoving = true
    styleMove('move')
    let success = await forwardHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function forwardHandler() {
    try {
      await back(motionClient, armClient);
      if (forwardbutton().classList.contains('custom-box-shadow-active')) {await forwardHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  backbutton().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await backHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  backbutton().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await backHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridBackLeft().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(-1,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridBackLeft().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(-1,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridBack().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(-1,0)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridBack().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(-1,0)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridBackRight().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(-1,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridBackRight().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(-1,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridLeft().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(0,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridLeft().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(0,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridRight().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(0,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridRight().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(0,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridFrontLeft().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(1,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridFrontLeft().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(1,-1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  gridFrontRight().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await quadrantMoveHander(1,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridFrontRight().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await quadrantMoveHander(1,1)
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function quadrantMoveHander(x,y) {
    try {
      await moveToQuadrant(motionClient, armClient, x, y);
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  async function backHandler() {
    try {
      await forward(motionClient, armClient);
      if (backbutton().classList.contains('custom-box-shadow-active')) {await backHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  rightbutton().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    isMoving = true
    styleMove('move')
    let success = await rightHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  rightbutton().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await rightHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function rightHandler() {
    try {
      await right(motionClient, armClient);
      if (rightbutton().classList.contains('custom-box-shadow-active')) {await rightHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  leftbutton().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await leftHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  leftbutton().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true;
    let success = await leftHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function leftHandler() {
    try {
      await left(motionClient, armClient);
      if (leftbutton().classList.contains('custom-box-shadow-active')) {await leftHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  dropbutton().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    isMoving = true
    styleMove('move')
    let success = await dropHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  dropbutton().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true;
    let success = await dropHandler()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function dropHandler() {
    try {
      await dropDown(motionClient, armClient);
      await grab(boardClient);
      await delay(1000);
      await up(motionClient, armClient);
      await home(motionClient, armClient);
      await delay(1000);
      await release(boardClient);
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 2000 )
      return false
    }
    return true
  }

  forwardbutton().disabled = false;
  backbutton().disabled = false;
  rightbutton().disabled = false;
  leftbutton().disabled = false;
  dropbutton().disabled = false;
}

main();

// disable user zooming
document.addEventListener('touchmove', function (event) {
  if (event.scale !== 1) { event.preventDefault(); }
}, { passive: false });

var lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  var now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

