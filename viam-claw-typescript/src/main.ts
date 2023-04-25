import { Client, BoardClient, MotionClient, createRobotClient } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';

async function connect() {
  //This is where you will list your robot secret. You can find this information
  //in your Code Sample tab on your robot page. Check the Typescript code sample 
  //to get started. :)  
  const secret = 't9hacog4ff66yjh4a00vaprrvkpq3ltwf3b3red7su4philq';
  const credential = {
    payload: secret,
    type: 'robot-location-secret',
  };

  //This is the host address of the main part of your robot.
  const host = 'arm-main.urykdsecy6.viam.cloud';

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


//Functions calling the grab and release actions of the claw 
function grabbutton() {
  return <HTMLButtonElement>document.getElementById('grab-button');
}

function releasebutton() {
  return <HTMLButtonElement>document.getElementById('release-button');
}

function homebutton() {
  return <HTMLButtonElement>document.getElementById('home-button');
}

function forwardbutton() {
  return <HTMLButtonElement>document.getElementById('forward-button');
}

function backbutton() {
  return <HTMLButtonElement>document.getElementById('back-button');
}

function rightbutton() {
  return <HTMLButtonElement>document.getElementById('right-button');
}

function leftbutton() {
  return <HTMLButtonElement>document.getElementById('left-button');
}

function dropbutton() {
  return <HTMLButtonElement>document.getElementById('drop-button');
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


async function home(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  // const mc = new MotionClient(client, name, {requestLogger: (req) => { console.log(req); } });
  const mc = new MotionClient(client, name)

  //Add table/floor obstacle to the Worldstate 
  let tableOrigin: SDK.Pose = {
    x: 0,
    y: 0,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: 1,
  };


  let table_dims: SDK.Vector3 = {
    x: 2000, 
    y: 2000, 
    z: 30
  }

  let myRectangularPrism: SDK.RectangularPrism ={
    dimsMm: table_dims
  }
  
  let table_object: SDK.Geometry = {
    center: tableOrigin,
    box: myRectangularPrism,
    label: ''
  }

  //Create a Worldstate that has the GeometriesInFrame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [table_object],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  //Generate a sample "home" position around the drop hole to demonstrate 
  //where the ball should be dropped 

  let home_pose: SDK.Pose = {
    x: 390,
    y: 105,
    z: 600,
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
    homebutton().disabled = true;
   
    console.log(await client.resourceNames())
    console.log('this is the framesys below')
    console.log(await client.frameSystemConfig(SDK.commonApi.Transform['']))
   
    let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }
    
    await mc.move(home_pose_in_frame, myResourceName, myWorldState, constraints)


   
  } finally {
    homebutton().disabled = false;
  }
}

async function forward(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  const mc = new MotionClient(client, name);
  
  //Add a front wall obstacle to the WorldState

  let frontWallOrigin: SDK.Pose = {
    x: 560,
    y: 0,
    z: 0,
    theta: 15,
    oX: 0,
    oY: 0,
    oZ: 1,
  };

  let frontWalldims: SDK.Vector3 = {
    x: 15, 
    y: 2000, 
    z: 1000
  }

  let frontRectangularPrism: SDK.RectangularPrism ={
    dimsMm: frontWalldims
  }

  let frontWallObject: SDK.Geometry ={
    center: frontWallOrigin, 
    box: frontRectangularPrism,
    label: '',
  }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [frontWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await mc.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let forwardPose: Pose = {
    x: currentPosition.pose!.x + 20,
    y: currentPosition.pose!.y,
    z: currentPosition.pose!.z,
    theta: currentPosition.pose!.theta,
    oX: currentPosition.pose!.oX,
    oY: currentPosition.pose!.oY, 
    oZ: -1
  };

  let forwardpose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: forwardPose
  }

  //Move x position forward by 50 units 
  await mc.move(forwardpose_in_frame, myResourceName, myWorldState, constraints)

}

async function back(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  const mc = new MotionClient(client, name);
  
  //Add a back wall obstacle to the WorldState
  

  let backWallOrigin: SDK.Pose = {
    x: 560,
    y: 0,
    z: 0,
    theta: 15,
    oX: 0,
    oY: 0,
    oZ: 1,
  };

  let backWalldims: SDK.Vector3 = {
    x: 15, 
    y: 2000, 
    z: 1000
  }

  let frontRectangularPrism: SDK.RectangularPrism ={
    dimsMm: backWalldims
  }

  let backWallObject: SDK.Geometry ={
    center: backWallOrigin, 
    box: frontRectangularPrism,
    label: '',
  }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [backWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await mc.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let backPose: Pose = {
    x: currentPosition.pose!.x -20,
    y: currentPosition.pose!.y,
    z: currentPosition.pose!.z,
    theta: currentPosition.pose!.theta,
    oX: currentPosition.pose!.oX,
    oY: currentPosition.pose!.oY, 
    oZ: -1
  };

  let backpose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: backPose
  }

  //Move x position forward by 50 units 
  await mc.move(backpose_in_frame, myResourceName, myWorldState, constraints)

  

}

async function right(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  const mc = new MotionClient(client, name);
  
  //Add a back wall obstacle to the WorldState
  let rightWallOrigin: SDK.Pose = {
    x: 0,
    y: 600,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: 1,
  };

  let rightWalldims: SDK.Vector3 = {
    x: 15, 
    y: 2000, 
    z: 1000
  }

  let rightRectangularPrism: SDK.RectangularPrism ={
    dimsMm: rightWalldims
  }

  let rightWallObject: SDK.Geometry ={
    center: rightWallOrigin, 
    box: rightRectangularPrism,
    label: '',
  }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [rightWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await mc.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let rightPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y + 20,
    z: currentPosition.pose!.z,
    theta: currentPosition.pose!.theta,
    oX: currentPosition.pose!.oX,
    oY: currentPosition.pose!.oY, 
    oZ: -1
  };

  let rightpose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: rightPose
  }

  //Move x position forward by 50 units 
  await mc.move(rightpose_in_frame, myResourceName, myWorldState, constraints)

}

async function left(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  const mc = new MotionClient(client, name);
  
  //Add a back wall obstacle to the WorldState

  let leftWallOrigin: SDK.Pose = {
    x: 0,
    y: 600,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: 1,
  };

  let leftWalldims: SDK.Vector3 = {
    x: 15, 
    y: 2000, 
    z: 1000
  }

  let leftRectangularPrism: SDK.RectangularPrism ={
    dimsMm: leftWalldims
  }

  let leftWallObject: SDK.Geometry ={
    center: leftWallOrigin, 
    box: leftRectangularPrism,
    label: '',
  }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [leftWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await mc.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))
  let leftPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y -20,
    z: currentPosition.pose!.z,
    theta: currentPosition.pose!.theta,
    oX: currentPosition.pose!.oX,
    oY: currentPosition.pose!.oY, 
    oZ: -1
  };

  let leftpose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: leftPose
  }

  //Move x position forward by 50 units 
  await mc.move(leftpose_in_frame, myResourceName, myWorldState, constraints)

}

async function dropDown(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'planning:builtin';
  const mc = new MotionClient(client, name);
  
  //Add a back wall obstacle to the WorldState

  let droporigin: SDK.Pose = {
    x: 0,
    y: 0,
    z: 0,
    theta: 105,
    oX: 0,
    oY: 0,
    oZ: -1,
  };

  let dropdims: SDK.Vector3 = {
    x: 15, 
    y: 2000, 
    z: 1000
  }

  let dropRectangularPrism: SDK.RectangularPrism ={
    dimsMm: dropdims
  }

  let dropWallObject: SDK.Geometry ={
    center: droporigin, 
    box: dropRectangularPrism,
    label: '',
  }

  //Create a WorldState that has Geometries in Frame included 

  let myObstaclesInFrame: SDK.GeometriesInFrame = {
    referenceFrame: "world", 
    geometriesList: [dropWallObject],
  }
  
  let myWorldState: SDK.WorldState ={
    obstaclesList: [myObstaclesInFrame],
    transformsList: [],
  }

  let myResourceName: ResourceName = {
      namespace: 'rdk', 
      type: 'component', 
      subtype: 'arm', 
      name: 'myArm' 
  }

  //Get current position of the arm 
  console.log('im trying to print the current position')
  let currentPosition = await mc.getPose(myResourceName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  
  let dropPose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: 280,
    theta: currentPosition.pose!.theta,
    oX: currentPosition.pose!.oX,
    oY: currentPosition.pose!.oY, 
    oZ: currentPosition.pose!.oZ
  };

  let droppose_in_frame: SDK.PoseInFrame ={
    referenceFrame: "world", 
    pose: dropPose
  }

  //Move x position forward by 50 units 
  await mc.move(droppose_in_frame, myResourceName, myWorldState, constraints)

}

async function grab(client: Client) {

  const name = 'myBoard';
  const bc = new BoardClient(client, name);

  try {
    grabbutton().disabled = true;

    console.log(await bc.getGPIO('8'));
    console.log('i`m grabbin');
    await bc.setGPIO('8', true);
    
   
  } finally {
    grabbutton().disabled = false;
  }
}

async function release(client: Client) {
  
  const name = 'myBoard';
  const bc = new BoardClient(client, name);

  try {
    grabbutton().disabled = true;

    console.log(await bc.getGPIO('8'));
    await bc.setGPIO('8', false);
    await delay(1000);
    console.log('i let go now');
    
   
  } finally {
    grabbutton().disabled = false;
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

  // Make the buttons in your webapp do something interesting :)
  grabbutton().onclick = async () => {
    await grab(client);

  };

  releasebutton().onclick = async () => {
    await release(client);
  }

  homebutton().onclick = async () => {
    await home(client);

  };

  forwardbutton().onclick = async () => {
    await forward(client);

  };

  backbutton().onclick = async () => {
    await back(client);

  };

  rightbutton().onclick = async () => {
    await right(client);

  };

  leftbutton().onclick = async () => {
    await left(client);

  };

  dropbutton().onclick = async () => {
    await dropDown(client);
  }

  grabbutton().disabled = false;
  releasebutton().disabled = false;
  homebutton().disabled = false;
  forwardbutton().disabled = false;
  backbutton().disabled = false;
  rightbutton().disabled = false;
  leftbutton().disabled = false;
  dropbutton().disabled = false;
}

main();
