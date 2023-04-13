import asyncio
import argparse

from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.board import Board
from viam.components.arm import Arm
from viam.services.motion import MotionServiceClient
from viam.proto.common import Pose, PoseInFrame, Vector3, Geometry, GeometriesInFrame, RectangularPrism, WorldState

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

async def home(arm, motion_service):
    # Add hole obstacle to the WorldState
    hole_origin = Pose(x=470, y=125, z=0, o_x=0, o_y=0, o_z=1, theta=15)
    hole_dims = Vector3(x=250, y=400, z=300)
    hole_object = Geometry(center=hole_origin, box=RectangularPrism(dims_mm=hole_dims))

    # Add a table/floor obstacle to the WorldState
    table_origin = Pose(x=0, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    table_dims = Vector3(x=2000, y=2000.0, z=30.0)
    table_object = Geometry(center=table_origin, box=RectangularPrism(dims_mm=table_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[table_object, hole_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Generate a sample "home" pose to demonstrate motion
    home_pose = Pose(x=400.0, y=105.0, z=600.0, o_x=0.0498, o_y=0.039, o_z=-0.998, theta=30.5)
    home_pose_in_frame = PoseInFrame(reference_frame="world", pose=home_pose)

    await motion_service.move(component_name=arm, destination=home_pose_in_frame, world_state=world_state)

async def test(arm, motion_service):
    # Add hole obstacle to the WorldState
    hole_origin = Pose(x=470, y=125, z=0, o_x=0, o_y=0, o_z=1, theta=15)
    hole_dims = Vector3(x=250, y=400, z=300)
    hole_object = Geometry(center=hole_origin, box=RectangularPrism(dims_mm=hole_dims))

    # Add a table/floor obstacle to the WorldState
    table_origin = Pose(x=-520, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    table_dims = Vector3(x=15, y=2000.0, z=1000.0)
    table_object = Geometry(center=table_origin, box=RectangularPrism(dims_mm=table_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[table_object, hole_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

     # Generate a sample "test" pose to demonstrate motion/where to pick up floor level
     # Random test position 
    test_pose = Pose(x=450.0, y=95, z=600.0, o_x=0.009, o_y=0.0001, o_z=-0.999, theta=32.7)
    test_pose_in_frame = PoseInFrame(reference_frame="world", pose=test_pose)

    await motion_service.move(component_name=arm, destination=test_pose_in_frame, world_state=world_state)

async def forward(arm, motion_service):

    # Add a front wall obstacle to a WorldState
    frontWall_origin = Pose(x=560, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=15)
    frontWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    frontWall_object = Geometry(center=frontWall_origin, box=RectangularPrism(dims_mm=frontWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[frontWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move x position by 50 forward
    forward_pose = Pose(
        x=current_position.pose.x + 50, 
        y=current_position.pose.y, 
        z=current_position.pose.z, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('forward_pose: ', forward_pose)

    forward_pose_in_frame = PoseInFrame(reference_frame="world", pose=forward_pose)
    
    # Move arm
    await motion_service.move(component_name=arm, destination=forward_pose_in_frame, world_state=world_state)

async def backward(arm, motion_service):

    # Add a back wall obstacle to a WorldState
    backWall_origin = Pose(x=-560, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=15)
    backWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    backWall_object = Geometry(center=backWall_origin, box=RectangularPrism(dims_mm=backWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[backWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move x position by 50 backwards
    backward_pose = Pose(
        x=current_position.pose.x - 50, 
        y=current_position.pose.y, 
        z=current_position.pose.z, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('backward_pose: ', backward_pose)

    backward_pose_in_frame = PoseInFrame(reference_frame="world", pose= backward_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=backward_pose_in_frame, world_state=world_state)

async def right(arm, motion_service):

    # Add a right wall obstacle to a WorldState
    rightWall_origin = Pose(x=0, y=600, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    rightWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    rightWall_object = Geometry(center=rightWall_origin, box=RectangularPrism(dims_mm=rightWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[rightWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move y position by 50 to right
    right_pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y + 50, 
        z=current_position.pose.z, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('right_pose: ', right_pose)

    right_pose_in_frame = PoseInFrame(reference_frame="world", pose= right_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=right_pose_in_frame, world_state=world_state)

async def left(arm, motion_service):

    # Add a left wall obstacle to a WorldState
    leftWall_origin = Pose(x=0, y=-600, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    leftWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    leftWall_object = Geometry(center=leftWall_origin, box=RectangularPrism(dims_mm=leftWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[leftWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move y position by 50 to the left
    left_pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y - 50, 
        z=current_position.pose.z, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('left_pose: ', left_pose)

    left_pose_in_frame = PoseInFrame(reference_frame="world", pose= left_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=left_pose_in_frame, world_state=world_state)

async def drop(arm, motion_service):

    # Add a table/floor obstacle to a WorldState
    table_origin = Pose(x=0, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    table_dims = Vector3(x=2000, y=2000.0, z=30.0)
    table_object = Geometry(center=table_origin, box=RectangularPrism(dims_mm=table_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[table_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move z position to 280
    drop_pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y, 
        z = 280,
        #z=current_position.pose.z - 340, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('drop_pose: ', drop_pose)

    drop_pose_in_frame = PoseInFrame(reference_frame="world", pose= drop_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=drop_pose_in_frame, world_state=world_state)

async def up(arm, motion_service):

    # Add a table/floor obstacle to a WorldState
    table_origin = Pose(x=0, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    table_dims = Vector3(x=2000, y=2000.0, z=30.0)
    table_object = Geometry(center=table_origin, box=RectangularPrism(dims_mm=table_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[table_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move z position to 600
    up_pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y, 
        z= 600,
        #z=current_position.pose.z + 340, 
        o_x=current_position.pose.o_x, 
        o_y=current_position.pose.o_y, 
        o_z=current_position.pose.o_z, 
        theta=current_position.pose.theta
    )
    print('up_pose: ', up_pose)

    up_pose_in_frame = PoseInFrame(reference_frame="world", pose= up_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=up_pose_in_frame, world_state=world_state)


async def main():
    robot = await connect()

    print('Resources:')
    print(robot.resource_names)

    # pose using motion service
    motion_service = MotionServiceClient.from_robot(robot, "builtin")
    
    # Note that the pin supplied is a placeholder. Please change this to a valid pin you are using.
    # myBoard
    my_board = Board.from_robot(robot, "myBoard")
    # my Subpart name, arm
    my_arm_resource= Arm.get_resource_name("planning:myArm")
        
    commands = [args.command]
    if args.command == "sequence":
        commands = args.sequence.split(",")
    
    for command in commands:
        if command == "drop":
            print("will drop")
            #z position from 600 to 280
            await drop(my_arm_resource, motion_service) 
        if command == "up":
            print("will go up")
            #z position from 280 to 600
            await up(my_arm_resource, motion_service) 
        if command == "home":
            print("will return home")
            #goes to home position
            await home(my_arm_resource, motion_service) 
        if command == "left":
            print("will move left")
            #moves y position with 50
            await left(my_arm_resource, motion_service) 
        if command == "right":
            print("will move right")
            #moves y position with 50
            await right(my_arm_resource, motion_service) 
        if command == "forward":
            print("will move forward")
            #moves y position with 50
            await forward(my_arm_resource, motion_service)
        if command == "backward":
            print("will move backward")
            #moves y position with 50
            await backward(my_arm_resource, motion_service)
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
            print("will move to test position, drop, grab, go up, go home then open")
            await test(my_arm_resource, motion_service) 
            await drop(my_arm_resource, motion_service)
            await grab(my_board, True)
            await up(my_arm_resource, motion_service)
            await home(my_arm_resource, motion_service) 
            await grab(my_board, False)

    # Don't forget to close the robot when you're done!
    await robot.close()

if __name__ == '__main__':
    asyncio.run(main())
