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
  return <HTMLTableCellElement>document.getElementById('grid-front-right');
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

  await motionClient.move(home_pose_in_frame, myResourceName, myWorldState, constraints)
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
      await motionClient.move(new_pose_in_frame, myResourceName, myWorldState, constraints)
    } finally {
      //homebutton().disabled = false;
    }
}

async function inPlaneMove(motionClient: MotionClient, armClient: ArmClient, xDist: number, yDist: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  // Calculate new position
  let pose: Pose = {
    x: currentPosition.pose!.x + xDist,
    y: currentPosition.pose!.y + yDist,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0, 
    oZ: -1
  };
  let pif: SDK.PoseInFrame = {
    referenceFrame: "world", 
    pose: pose
  }

  // Move to new position
  console.log('moving to:' + JSON.stringify(pif))
  await motionClient.move(pif, myResourceName, myWorldState, constraints)
}

async function zMove(motionClient: MotionClient, armClient: ArmClient, zHeight: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }
  
  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  let pose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: zHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };
  let pif: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: pose
  }

  // Move to new position
  console.log('moving in Z direction to:' + JSON.stringify(pif))
  await motionClient.move(pif, myResourceName, myWorldState, constraints)
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

  async function quadrantMoveHandler(x,y) {
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
  
  async function mouseDown(func: Promise<boolean>) {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await func
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  
  async function touchStart(func: Promise<boolean>) {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await func
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  
  // forward
  forwardbutton().onmousedown = async () => {mouseDown(forwardHandler())};
  forwardbutton().ontouchstart = async () => {touchStart(forwardHandler())};


  async function forwardHandler() {
    try {
      await inPlaneMove(motionClient, armClient, -moveDistance, 0);
      if (forwardbutton().classList.contains('custom-box-shadow-active')) {await forwardHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  // backward
  backbutton().onmousedown = async () => {mouseDown(backHandler())};
  backbutton().ontouchstart = async () => {touchStart(backHandler())};

  // -1, -1
  gridBackLeft().onmousedown = async () => {mouseDown(quadrantMoveHandler(-1, -1))};
  gridBackLeft().ontouchstart = async () => {touchStart(quadrantMoveHandler(-1, -1))};

  // -1, 0
  gridBack().onmousedown = async () => {mouseDown(quadrantMoveHandler(-1, 0))};
  gridBack().ontouchstart = async () => {touchStart(quadrantMoveHandler(-1, 0))};

  // -1, 1
  gridBackRight().onmousedown = async () => {mouseDown(quadrantMoveHandler(-1, 1))};
  gridBackRight().ontouchstart = async () => {touchStart(quadrantMoveHandler(-1, 1))};

  // 0, -1
  gridLeft().onmousedown = async () => {mouseDown(quadrantMoveHandler(0, -1))};
  gridLeft().ontouchstart = async () => {touchStart(quadrantMoveHandler(0, -1))};

  // 0, 1
  gridRight().onmousedown = async () => {mouseDown(quadrantMoveHandler(0, 1))};
  gridRight().ontouchstart = async () => {touchStart(quadrantMoveHandler(0, 1))};

  // 1, -1
  gridFrontLeft().onmousedown = async () => {mouseDown(quadrantMoveHandler(1, -1))};
  gridFrontLeft().ontouchstart = async () => {touchStart(quadrantMoveHandler(1, -1))};

  // 1, 1
  gridFrontRight().onmousedown = async () => {mouseDown(quadrantMoveHandler(1, 1))};
  gridFrontRight().ontouchstart = async () => {touchStart(quadrantMoveHandler(1, 1))};


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


  async function backHandler() {
    try {
      await inPlaneMove(motionClient, armClient, moveDistance, 0);
      if (backbutton().classList.contains('custom-box-shadow-active')) {await backHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  rightbutton().onmousedown = async () => {mouseDown(rightHandler())};
  rightbutton().ontouchstart = async () => {touchStart(rightHandler())};

  async function rightHandler() {
    try {
      await inPlaneMove(motionClient, armClient, 0, moveDistance);
      if (rightbutton().classList.contains('custom-box-shadow-active')) {await rightHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  leftbutton().onmousedown = async () => {mouseDown(leftHandler())};
  leftbutton().ontouchstart = async () => {touchStart(leftHandler())};

  async function leftHandler() {
    try {
      await inPlaneMove(motionClient, armClient, 0, -moveDistance);
      if (leftbutton().classList.contains('custom-box-shadow-active')) {await leftHandler()};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, 3000 )
      return false
    }
    return true
  }

  dropbutton().onmousedown = async () => {mouseDown(dropHandler())};
  dropbutton().ontouchstart = async () => {touchStart(dropHandler())};

  async function dropHandler() {
    try {
      await zMove(motionClient, armClient, 240);
      await grab(boardClient);
      await delay(1000);
      await zMove(motionClient, armClient, moveHeight);
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


