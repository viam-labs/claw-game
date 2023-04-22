import { Client, BoardClient, MotionClient, createRobotClient} from '@viamrobotics/sdk';
import { GeometriesInFrame, Geometry, Pose, PoseInFrame, RectangularPrism, ResourceName, Vector3, WorldState } from '@viamrobotics/sdk/dist/gen/common/v1/common_pb';
import { Constraints, OrientationConstraint } from '@viamrobotics/sdk/dist/gen/service/motion/v1/motion_pb';

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

//Creating a delay function for timing 
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

var constraints = new Constraints()
let theOrientConstraint = new OrientationConstraint()

let myVerySuperCoolAwesomeOrientationConstraintArrayThatHasOnlyOneThing: OrientationConstraint[] = [theOrientConstraint]
constraints.setOrientationConstraintList(myVerySuperCoolAwesomeOrientationConstraintArrayThatHasOnlyOneThing)



async function home(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'myArm';
  const mc = new MotionClient(client, name);

  let tableOrigin = new Pose()

  tableOrigin.setOX(0)
  tableOrigin.setOY(0)
  tableOrigin.setOZ(1)
  tableOrigin.setTheta(105)
  tableOrigin.setX(0)
  tableOrigin.setY(0)
  tableOrigin.setZ(0)

  let table_dims = new Vector3()
  table_dims.setX(2000)
  table_dims.setY(2000)
  table_dims.setZ(30)

  let table_object = new Geometry()

  let myRectangularPrism = new RectangularPrism()
  myRectangularPrism.setDimsMm(table_dims)

  table_object.setCenter(tableOrigin)
  table_object.setBox(myRectangularPrism)

  let myObstaclesInFrame = new GeometriesInFrame()
  let myCooolArray : Geometry[] = []
  myCooolArray.push(table_object)

  myObstaclesInFrame.setReferenceFrame("world")
  myObstaclesInFrame.setGeometriesList(myCooolArray)

  let myWorldState = new WorldState();

  myWorldState.addObstacles(myObstaclesInFrame)


  let home_pose = new Pose()

  home_pose.setX(390)
  home_pose.setY(105)
  home_pose.setZ(600)
  home_pose.setOX(0)
  home_pose.setOY(0)
  home_pose.setOZ(1)
  home_pose.setTheta(0)

  let home_pose_in_frame = new PoseInFrame()
  home_pose_in_frame.setReferenceFrame("world")
  home_pose_in_frame.setPose(home_pose)

  try {
    homebutton().disabled = true;

    console.log('home position?');
   

    let myResourceName = new ResourceName()
    myResourceName.setName('myArm')

    await mc.move(home_pose_in_frame, myResourceName, myWorldState, constraints)
  
   
  } finally {
    homebutton().disabled = false;
  }
}

async function grab(client: Client) {
  //When you create a new client, list your component name here.
  const name = 'myBoard';
  const bc = new BoardClient(client, name);

  try {
    grabbutton().disabled = true;

    console.log(await bc.getGPIO('8'));
    console.log('i`m grabbin this shit');
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

  homebutton().onclick = async () => {
    await home(client);

  };

  releasebutton().onclick = async () => {
    await release(client);
  }

  grabbutton().disabled = false;
  releasebutton().disabled = false;
  homebutton().disabled = false;
}

main();
