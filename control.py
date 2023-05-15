import asyncio
import argparse

from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.board import Board
from viam.components.arm import Arm
from viam.services.motion import MotionClient
from viam.proto.common import Pose, PoseInFrame, Vector3, Geometry, GeometriesInFrame, RectangularPrism, WorldState
from viam.proto.service.motion import Constraints, LinearConstraint, OrientationConstraint

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
    # Note that the pin supplied is a placeholder. Please change this to a valid pin you are using.
    pin = await board.gpio_pin_by_name('8')
    if doGrab == True:
        #opens the gripper/release
        await pin.set(True)
    else:
       #closes the gripper/grab
       await pin.set(False)

# If you like to test with linear constaints instead of orientation, uncomment the below
#constraints = Constraints(linear_constraint=[LinearConstraint(line_tolerance_mm=5)])
constraints = Constraints(orientation_constraint = [OrientationConstraint()])

async def home(arm, motion_service):
    # Makes sure to first move the arm up in z axis
    await up(arm, motion_service)

    # Add a hole obstacle to the WorldState
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

    # Generate a sample "home" pose around the drop hole and demonstrate motion
    home_pose = Pose(x=390.0, y=105.0, z=500.0, o_x=0, o_y=0, o_z=-1, theta=0)
    home_pose_in_frame = PoseInFrame(reference_frame="world", pose=home_pose)

    await motion_service.move(component_name=arm, destination=home_pose_in_frame, world_state=world_state, constraints=constraints)

async def test(arm, motion_service):

    # Add a table/floor obstacle to the WorldState
    table_origin = Pose(x=-520, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    table_dims = Vector3(x=15, y=2000.0, z=1000.0)
    table_object = Geometry(center=table_origin, box=RectangularPrism(dims_mm=table_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[table_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

     # Generate a sample "test" pose around where to pick up floor level and demonstrate motion
     # Random test position within the enclosure
    test_pose = Pose(x=00.0, y=380, z=500.0, o_x=0, o_y=0, o_z=-1, theta=0)
    test_pose_in_frame = PoseInFrame(reference_frame="world", pose=test_pose)

    await motion_service.move(component_name=arm, destination=test_pose_in_frame, world_state=world_state, constraints=constraints)

async def forward(arm, motion_service):

    # Add a front wall obstacle to the WorldState
    frontWall_origin = Pose(x=560, y=0, z=0, o_x=0, o_y=0, o_z=1, theta=15)
    frontWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    frontWall_object = Geometry(center=frontWall_origin, box=RectangularPrism(dims_mm=frontWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[frontWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move x position by 50 forwards
    forward_pose = Pose(
        x=current_position.pose.x + 50, 
        y=current_position.pose.y, 
        z=current_position.pose.z, 
        o_x=0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('forward_pose: ', forward_pose)

    forward_pose_in_frame = PoseInFrame(reference_frame="world", pose=forward_pose)
    
    # Move arm
    await motion_service.move(component_name=arm, destination=forward_pose_in_frame, world_state=world_state, constraints=constraints)

async def backward(arm, motion_service):

    # Add a back wall obstacle to the WorldState
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
        o_x=0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('backward_pose: ', backward_pose)

    backward_pose_in_frame = PoseInFrame(reference_frame="world", pose= backward_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=backward_pose_in_frame, world_state=world_state, constraints=constraints)

async def right(arm, motion_service):

    # Add a right wall obstacle to the WorldState
    rightWall_origin = Pose(x=0, y=600, z=0, o_x=0, o_y=0, o_z=1, theta=105)
    rightWall_dims = Vector3(x=15, y=2000.0, z=1000.0)
    rightWall_object = Geometry(center=rightWall_origin, box=RectangularPrism(dims_mm=rightWall_dims))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=[rightWall_object])

    # Create a WorldState that has the GeometriesInFrame included
    world_state = WorldState(obstacles=[obstacles_in_frame])

    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Move y position by 50 to the right
    right_pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y + 50, 
        z=current_position.pose.z, 
        o_x=0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('right_pose: ', right_pose)

    right_pose_in_frame = PoseInFrame(reference_frame="world", pose= right_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=right_pose_in_frame, world_state=world_state, constraints=constraints)

async def left(arm, motion_service):

    # Add a left wall obstacle to the WorldState
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
        o_x=0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('left_pose: ', left_pose)

    left_pose_in_frame = PoseInFrame(reference_frame="world", pose= left_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=left_pose_in_frame, world_state=world_state, constraints=constraints)

async def drop(arm, motion_service):

    # Add a table/floor obstacle to the WorldState
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
        # Change this number if floor position changes
        z = 280,
        o_x= 0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('drop_pose: ', drop_pose)

    drop_pose_in_frame = PoseInFrame(reference_frame="world", pose= drop_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=drop_pose_in_frame, world_state=world_state, constraints=constraints)

async def up(arm, motion_service):

    # Add a table/floor obstacle to the WorldState
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
        z= 500,
        o_x=0, 
        o_y=0, 
        # This allows for it to always look down 
        o_z=-1, 
        theta=0
    )
    print('up_pose: ', up_pose)

    up_pose_in_frame = PoseInFrame(reference_frame="world", pose= up_pose)

    # Move arm
    await motion_service.move(component_name=arm, destination=up_pose_in_frame, world_state=world_state, constraints=constraints)


async def main():
    robot = await connect()

    print('Resources:')
    print(robot.resource_names)

    # Pose using motion service, grabbing the service from local computer
    motion_service = MotionClient.from_robot(robot, "planning:builtin")
    
    # myBoard
    my_board = Board.from_robot(robot, "myBoard")
    # my Subpart name, arm
    my_arm_resource= Arm.get_resource_name("planning:myArm")
    my_arm_resource.name= "myArm"
    print("arm resource", my_arm_resource)
        
    commands = [args.command]
    if args.command == "sequence":
        commands = args.sequence.split(",")
    
    for command in commands:
        if command == "drop":
            print("will drop")
            # Moves the arm's z position from 600 to 260
            await drop(my_arm_resource, motion_service) 
        if command == "up":
            print("will go up")
            # Moves the arm's z position from 260 to 600
            await up(my_arm_resource, motion_service) 
        if command == "home":
            print("will return home")
            # Goes to home position
            await home(my_arm_resource, motion_service) 
        if command == "left":
            print("will move left")
            # Moves the arm's y position with 50 in one direction
            await left(my_arm_resource, motion_service) 
        if command == "right":
            print("will move right")
            # Moves the arm's y position with 50 in one direction
            await right(my_arm_resource, motion_service) 
        if command == "forward":
            print("will move forward")
            # Moves the arm's x position with 50 in one direction
            await forward(my_arm_resource, motion_service)
        if command == "backward":
            print("will move backward")
            # Moves the arm's x position with 50 in one direction
            await backward(my_arm_resource, motion_service)
        if command == "grab":
            print("will grab")
            # Closes the gripper
            await grab(my_board, True)
        if command == "release":
            print("will release")
            # Opens the gripper
            await grab(my_board, False)
        if command == "sleep":
            print("will sleep one second")
            await asyncio.sleep(1)
        if command == "test":
            print("will move to test position, drop, grab, return home and release")
            await test(my_arm_resource, motion_service) 
            await drop(my_arm_resource, motion_service)
            await grab(my_board, True)
            await home(my_arm_resource, motion_service) 
            await grab(my_board, False)

    # Don't forget to close the robot when you're done!
    await robot.close()

if __name__ == '__main__':
    asyncio.run(main())
