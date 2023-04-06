import asyncio
import argparse

from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.board import Board
from viam.components.camera import Camera

parser = argparse.ArgumentParser()
parser.add_argument('--command', type=str, required=True)
parser.add_argument('--sequence', type=str, required=False)
parser.add_argument('--location', type=str, required=True)
parser.add_argument('--password', type=str, required=True)

args = parser.parse_args()

async def connect():
    creds = Credentials(
        type='robot-location-secret',
        payload=args.password)
    opts = RobotClient.Options(
        refresh_interval=0,
        dial_options=DialOptions(credentials=creds)
    )
    return await RobotClient.at_address(args.location, opts)

async def grab(board, doGrab):
    pin = await board.gpio_pin_by_name('8')
    if doGrab == True:
        await pin.set(True)
    else:
       await pin.set(False)

async def main():
    robot = await connect()

    print('Resources:')
    print(robot.resource_names)
    
    # Note that the pin supplied is a placeholder. Please change this to a valid pin you are using.
    # myBoard
    my_board = Board.from_robot(robot, "myBoard")
        
    commands = [args.command]
    if args.command == "sequence":
        commands = args.sequence.split(",")
    
    for command in commands:
        if command == "drop":
            print("will drop, grab, return home and open")
        if command == "home":
            print("will return home")
        if command == "left":
            print("will move left")
        if command == "right":
            print("will move right")
        if command == "forward":
            print("will move forward")
        if command == "back":
            print("will move backward")
        if command == "grab":
            print("will grab")
            await grab(my_board, True)
        if command == "release":
            print("will release")
            await grab(my_board, False)
        if command == "sleep":
            print("will sleep one second")
            await asyncio.sleep(1)
        if command == "test":
            print("will move to test position, drop, grab, go home then open")
    
    # Don't forget to close the robot when you're done!
    await robot.close()

if __name__ == '__main__':
    asyncio.run(main())
