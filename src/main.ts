import { Client, BoardClient, MotionClient, ArmClient, createRobotClient, 
StreamClient, commonApi } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';
import obstacles from '../obstacles.json';

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

const robotAPIKey = process.env.VIAM_API_KEY
const robotAPIKeyID = process.env.VIAM_API_KEY_ID
const robotLocation = process.env.VIAM_LOCATION
const grabberPin = '8'
const moveDistance = 20
const ignoreInterrupts = true
const moveHeight = 500
const gridSize = 3
const reachMm = 560
const moveTimeout = 3000

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

let constraints: Constraints = {
  orientationConstraintList: [
    {orientationToleranceDegs: 5},
  ],
  linearConstraintList: [],
  collisionSpecificationList: [],
};

const armName: ResourceName = {
  namespace: 'rdk', 
  type: 'component', 
  subtype: 'arm', 
  name: 'myArm' 
}

async function connect() {
  //This is where you will list your robot secret. You can find this information
  //in your Code Sample tab on your robot page. Check the Typescript code sample 
  //to get started. :)  
  const secret = robotSecret;
  const credential = {
    type: 'api-key',
    payload: robotAPIKey,
  };

  //This is the host address of the main part of your robot.
  const host = robotLocation;

  return createRobotClient({
    host,
    credential,
    authEntity: robotAPIKeyID,
    signalingAddress: 'https://app.viam.com:443',
  });
}

//Creating a delay function for timing 
function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

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

  await motionClient.move(home_pose_in_frame, armName, myWorldState, constraints)
}

async function moveToQuadrant(motionClient: MotionClient, armClient: ArmClient, x: number, y: number) {
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
      await motionClient.move(new_pose_in_frame, armName, myWorldState, constraints)
    } finally {
      // homebutton().disabled = false;
    }
}

async function inPlaneMove(motionClient: MotionClient, armClient: ArmClient, xDist: number, yDist: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(armName, 'world', [])
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
  await motionClient.move(pif, armName, myWorldState, constraints)
}

async function zMove(motionClient: MotionClient, armClient: ArmClient, zHeight: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }
  
  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(armName, 'world', [])
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
  await motionClient.move(pif, armName, myWorldState, constraints)
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

  // Helper functions to define button behavior
  async function mouseDown(func: () => Promise<boolean>) {
    if (isMoving) return
    if (useTouch) return
    styleMove('move')
    isMoving = true
    let success = await func()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };

  async function touchStart(func: () => Promise<boolean>) {
    if (isMoving) return
    styleMove('move')
    isMoving = true
    useTouch = true
    let success = await func()
    if (success) {
      styleMove('ready')
      isMoving = false
    }
  };
  
  function setButtonBehavior(button: HTMLTableCellElement, func: () => Promise<boolean>) {
    button.onmousedown = async () => {mouseDown(func)}; 
    button.ontouchstart = async () => {touchStart(func)};
  }

  // Define buttons for incremental movement in plane
  async function planarMoveHandler(button: HTMLTableCellElement, x:number, y: number) {
    try {
      await inPlaneMove(motionClient, armClient, x, y);
      if (button.classList.contains('custom-box-shadow-active')) {await planarMoveHandler(button, x, y)};
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, moveTimeout)
      return false
    }
    return true
  };

  const forwardbutton = <HTMLTableCellElement>document.getElementById('forward-button');
  const backbutton = <HTMLTableCellElement>document.getElementById('back-button');
  const rightbutton = <HTMLTableCellElement>document.getElementById('right-button');
  const leftbutton = <HTMLTableCellElement>document.getElementById('left-button');

  setButtonBehavior(forwardbutton, () => planarMoveHandler(forwardbutton, -moveDistance, 0));
  setButtonBehavior(backbutton, () => planarMoveHandler(backbutton, moveDistance, 0));
  setButtonBehavior(rightbutton, () => planarMoveHandler(rightbutton, 0, moveDistance));
  setButtonBehavior(leftbutton, () => planarMoveHandler(leftbutton, 0, -moveDistance));

  // Define buttons for movement between quadrants
  async function moveHandler(func: Promise<void>) {
    try {
      await func;
    } catch (error) {
      console.log(error);
      styleMove('error')
      setTimeout( () => { styleMove('ready'); isMoving = false; }, moveTimeout)
      return false
    }
    return true
  }

  const gridBackLeft = <HTMLTableCellElement>document.getElementById('grid-back-left');
  const gridBack = <HTMLTableCellElement>document.getElementById('grid-back');
  const gridBackRight = <HTMLTableCellElement>document.getElementById('grid-back-right');
  const gridLeft = <HTMLTableCellElement>document.getElementById('grid-left');
  const gridHome = <HTMLTableCellElement>document.getElementById('grid-home');
  const gridRight = <HTMLTableCellElement>document.getElementById('grid-right');
  const gridFrontLeft = <HTMLTableCellElement>document.getElementById('grid-front-left');
  const gridFrontRight = <HTMLTableCellElement>document.getElementById('grid-front-right');

  setButtonBehavior(gridBackLeft, () => moveHandler(moveToQuadrant(motionClient, armClient, -1, -1)));
  setButtonBehavior(gridBack, () => moveHandler(moveToQuadrant(motionClient, armClient, -1, 0)));
  setButtonBehavior(gridBackRight, () => moveHandler(moveToQuadrant(motionClient, armClient, -1, 1)));
  setButtonBehavior(gridLeft, () => moveHandler(moveToQuadrant(motionClient, armClient, 0, -1)));
  setButtonBehavior(gridHome, () => moveHandler(home(motionClient, armClient)))
  setButtonBehavior(gridRight, () => moveHandler(moveToQuadrant(motionClient, armClient, 0, 1)));
  setButtonBehavior(gridFrontLeft, () => moveHandler(moveToQuadrant(motionClient, armClient, 1, -1)));
  setButtonBehavior(gridFrontRight, () => moveHandler(moveToQuadrant(motionClient, armClient, 1, 1)));

  // Define button to grab and return object
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

  const dropbutton = <HTMLTableCellElement>document.getElementById('drop-button');
  
  setButtonBehavior(dropbutton, () => dropHandler());


  forwardbutton.disabled = false;
  backbutton.disabled = false;
  rightbutton.disabled = false;
  leftbutton.disabled = false;
  dropbutton.disabled = false;
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
