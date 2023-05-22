import { Client, BoardClient, MotionClient, ArmClient, createRobotClient, 
StreamClient, commonApi } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';
import obstacles from '../obstacles.json';
//import * as env from 'env';

//console.log(env)

// globals
const geomList :SDK.Geometry[]  = [];
for (const obs of obstacles){
  const geom :SDK.Geometry = {
    label: obs.label,
    center: {
      x: obs.translation.x,
      y: obs.translation.y,
      z: obs.translation.z,
      oX: obs.orientation.value.x,
      oY: obs.orientation.value.y,
      oZ: obs.orientation.value.z,
      theta: obs.orientation.value.th
    },
    box: {
      dimsMm: {
        x: obs.x,
        y: obs.y,
        z: obs.z,
      }
    }
  }
  geomList.push(geom);
}

let myObstaclesInFrame: SDK.GeometriesInFrame = {
  referenceFrame: "world", 
  geometriesList: geomList,
}

let myWorldState: SDK.WorldState ={
  obstaclesList: [myObstaclesInFrame],
  transformsList: [],
}

const robotSecret = process.env.VIAM_SECRET
const robotLocation = process.env.VIAM_LOCATION
const grabberPin = '8'
const moveDistance = 20
const ignoreInterrupts = true
const moveHeight = 500
const gridSize = 3
const reachMm = 560
// if we mount the arm straight we don't need this
const offset = 0
const quadrantSize = (reachMm*2)/gridSize
let gridPositions = {
  '1,1' : {x :270, y: 450}, 
  '1,-1' : { x: 300, y: -283},
  '-1,-1': {x: -373, y: -463},
  '-1,0': {x: -373, y: -90},
  '-1,1': {x: -373, y: 283},
  '0,1': {x: 0, y: 373},
  '0,-1': {x: 0, y: -373}
}
// if this is set to true, we calculate based on enclosure geometry
const useQuandrantMath = true
// random animations will show on move if set to true
const useAnimations = false

const myResourceName: ResourceName = {
  namespace: 'rdk', 
  type: 'component', 
  subtype: 'arm', 
  name: 'myArm' 
}

async function connect() {
  const secret = robotSecret;
  const credential = {
    payload: secret,
    type: 'robot-location-secret',
  };

  // This is the host address of the main part of your robot.
  const host = robotLocation;

  // This is the signaling address of your robot. Typically this would not need to be modified.
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
  return <HTMLTableCellElement>document.getElementById('forward-button');

}

function backbutton() {
  return <HTMLTableCellElement>document.getElementById('back-button');
}

function rightbutton() {
  return <HTMLTableCellElement>document.getElementById('right-button');
}

function leftbutton() {
  return <HTMLTableCellElement>document.getElementById('left-button');
}

function dropbutton() {
  return <HTMLTableCellElement>document.getElementById('drop-button');
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

function gridHome() {
  return <HTMLTableCellElement>document.getElementById('grid-home');
}

function gridFrontRight() {
  return 
<HTMLTableCellElement>document.getElementById('grid-front-right');
}

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

  // home position - where ball should be dropped and each game starts
  let home_pose: SDK.Pose = {
    x: 390,
    y: 10,
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

  await motionClient.move(home_pose_in_frame, myResourceName, 
myWorldState, constraints)
}

async function moveToQuadrant(motionClient: MotionClient, armClient: 
ArmClient, x: number, y: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }
    let pose: SDK.Pose = {
      x: 390,
      y: 105,
      z: moveHeight,
      theta: 0,
      oX: 0,
      oY: 0,
      oZ: -1,
    }

    if (useQuandrantMath) {
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
      pose = {
        x: xTarget + xOffset,
        y: yTarget + yOffset,
        z: moveHeight,
        theta: 0,
        oX: 0,
        oY: 0,
        oZ: -1,
      };
    } else {
      let gridLookup = x + ',' + y
      pose.x = gridPositions[gridLookup].x
      pose.y = gridPositions[gridLookup].y
    }

    console.log(x, y, pose)

    let new_pose_in_frame: SDK.PoseInFrame ={
      referenceFrame: "world", 
      pose: pose
    }
  
    try {       
      await motionClient.move(new_pose_in_frame, myResourceName, 
myWorldState, constraints)
    } finally {
      //homebutton().disabled = false;
    }
}

async function forward(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Get current position of the arm 
  console.log('im trying to print the current position!')
  let currentPosition = await motionClient.getPose(myResourceName, 
'world', [])
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

  console.log(JSON.stringify(forwardPoseInFrame))
  await motionClient.move(forwardPoseInFrame, myResourceName, 
myWorldState, constraints)
}

async function back(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 
'world', [])
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

  await motionClient.move(backPoseInFrame, myResourceName, myWorldState, 
constraints)
}

async function right(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 
'world', [])
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

  await motionClient.move(rightPoseInFrame, myResourceName, myWorldState, 
constraints)
}

async function left(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { console.log("Too fast!"); return }

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

  await motionClient.move(leftPoseInFrame, myResourceName, myWorldState, 
constraints)
}

async function dropDown(motionClient: MotionClient, armClient: ArmClient) 
{
  if (ignoreInterrupts && await armClient.isMoving()) { return }
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
    oZ: -1
  };

  let dropPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: dropPose
  }

  //Drop the claw down
  console.log('im about to drop to' + JSON.stringify(dropPoseInFrame))
  await motionClient.move(dropPoseInFrame, myResourceName, myWorldState, 
constraints)
  console.log('dropped')

}

async function up(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }
  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await motionClient.getPose(myResourceName, 
'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  
  let upPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: moveHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };

  let upPoseInFrame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: upPose
  }

  //Pick the claw up 
  console.log('let`s go up')
  await motionClient.move(upPoseInFrame, myResourceName, myWorldState, 
constraints)
  console.log('up!')

}

async function grab(boardClient: BoardClient) {
  try {
    console.log(await boardClient.getGPIO(grabberPin));
    console.log('i`m grabbin');
    await boardClient.setGPIO(grabberPin, true);
    
   
  } finally {

  }
}

async function release(boardClient: BoardClient) {
  try {
    console.log(await boardClient.getGPIO(grabberPin));
    await boardClient.setGPIO(grabberPin, false);
    await delay(1000);
    console.log('i let go now');
  } finally {
  }
}

async function main() {
  console.log("hello there")
  console.log('myWorldState:', myWorldState);
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
      // randomly animate
      if (useAnimations) {
        let rand = Math.floor(Math.random() * 50) + 1
        if (rand < 20) {
          document.getElementById('animate-left').style.backgroundImage = "url(images/animate/animate" + rand + ".webp)"
          document.getElementById('animate-right').style.backgroundImage = "url(images/animate/animate" + rand + ".webp)"
        }
      }
    } else if (state === 'ready') {
      element.classList.remove('grid-container-error')
      element.classList.remove('grid-container-moving')
      element.classList.add('grid-container-ready')
      document.getElementById('animate-left').style.backgroundImage = ''
      document.getElementById('animate-right').style.backgroundImage = ''
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

  gridHome().onmousedown = async () => {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await homeHandler();
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  gridHome().ontouchstart = async () => {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await homeHandler();
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  
  async function homeHandler() {
    try {
      await home(motionClient, armClient);
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

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


