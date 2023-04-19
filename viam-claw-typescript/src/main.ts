import { Client, BoardClient, createRobotClient } from '@viamrobotics/sdk';

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

//Creating a delay function for timing 
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
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

  releasebutton().onclick = async () => {
    await release(client);
  }

  grabbutton().disabled = false;
  releasebutton().disabled = false;
}

main();
