import asyncio
import argparse
import json

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
parser.add_argument('--apikey', type=str, required=True)
parser.add_argument('--apikeyid', type=str, required=True)

args = parser.parse_args()

# The amount to move in mm for each command forward, backward, left, right
move_increment = 50

# Define home position to return to 
home_plane = 500.0
home_pose = Pose(x=390.0, y=105.0, z=home_plane, o_x=0, o_y=0, o_z=-1, theta=0)

# Define plane to grab on
grab_plane = 240.0

# If you like to test with linear constaints instead of orientation, uncomment the below
#constraints = Constraints(linear_constraint=[LinearConstraint(line_tolerance_mm=5)])
constraints = Constraints(orientation_constraint = [OrientationConstraint()])

# Define world_state representing the physical environment the claw exists in 
def get_world_state():
    with open('obstacles.json', 'r') as f:
        geometries = json.load(f)

    world_state_obstacles = []
    for geometry in geometries:
        center = geometry['translation']
        orientation = geometry['orientation']['value']
        center = Pose(
            x=center['x'], 
            y=center['y'], 
            z=center['z'], 
            o_x=orientation['x'], 
            o_y=orientation['y'], 
            o_z=orientation['z'], 
            theta=orientation['th'],
        )
        dims = Vector3(x=geometry['x'], y=geometry['y'], z=geometry['z'])
        world_state_obstacles.append(Geometry(center=center, box=RectangularPrism(dims_mm=dims), label=geometry['label']))

    obstacles_in_frame = GeometriesInFrame(reference_frame="world", geometries=world_state_obstacles)
    return WorldState(obstacles=[obstacles_in_frame])
world_state = get_world_state()

async def connect():
    opts = RobotClient.Options.with_api_key(
      api_key=args.apikey,
      api_key_id=args.apikeyid
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

async def move_absolute(arm, motion_service, pose):
    destination = PoseInFrame(reference_frame="world", pose=pose)
    await motion_service.move(component_name=arm, destination=destination, world_state=world_state, constraints=constraints)

async def home(arm, motion_service):
    # Makes sure to first move the arm up in z axis
    await move_z(arm, motion_service, 500)

    # Generate a sample "home" pose around the drop hole and demonstrate motion
    home_pose_in_frame = PoseInFrame(reference_frame="world", pose=home_pose)

    await motion_service.move(component_name=arm, destination=home_pose_in_frame, world_state=world_state, constraints=constraints)

async def move_to_offset(arm, motion_service, offset):
    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current position: ', current_position)
    
    # Calculate new pose to move the arm to
    pose = Pose(
        x=current_position.pose.x + offset.x, 
        y=current_position.pose.y + offset.y,
        z=current_position.pose.z + offset.z,
        o_x=0, 
        o_y=0, 
        o_z=-1, # negative z means claw will point down
        theta=0
    )
    print('moving to position: ', pose)

    # Move arm
    destination = PoseInFrame(reference_frame="world", pose=pose)
    await motion_service.move(component_name=arm, destination=destination, world_state=world_state, constraints=constraints)


async def move_z(arm, motion_service, z):
    # Get current position of the arm
    current_position = await motion_service.get_pose(component_name=arm, destination_frame = "", supplemental_transforms = None)
    print('current_position: ', current_position)
    
    # Construct new pose to get to desired z position
    pose = Pose(
        x=current_position.pose.x, 
        y=current_position.pose.y, 
        z = z,
        o_x= 0, 
        o_y=0, 
        o_z=-1, # negative z means claw will point down
        theta=0
    )
    print('moving to position: ', pose)

    # Move arm
    destination = PoseInFrame(reference_frame="world", pose=pose)
    await motion_service.move(component_name=arm, destination=destination, world_state=world_state, constraints=constraints)

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
            # Moves the arm's z position to grab plane
            await move_z(my_arm_resource, motion_service, grab_plane) 
        if command == "up":
            print("will go up")
            # Moves the arm's z position to home plane
            await move_z(my_arm_resource, motion_service, home_plane) 
        if command == "home":
            print("will return home")
            # Goes to home position
            await home(my_arm_resource, motion_service) 
        if command == "left":
            print("will move left")
            # Moves the arm's y position to left
            await move_to_offset(my_arm_resource, motion_service, Vector3(x=0, y=-move_increment, z=0)) 
        if command == "right":
            print("will move right")
            # Moves the arm's y position to right
            await move_to_offset(my_arm_resource, motion_service, Vector3(x=0, y=move_increment, z=0)) 
        if command == "forward":
            print("will move forward")
            # Moves the arm's x position to forward
            await move_to_offset(my_arm_resource, motion_service, Vector3(x=move_increment, y=0, z=0))
        if command == "backward":
            print("will move backward")
            # Moves the arm's x position to backwards
            await move_to_offset(my_arm_resource, motion_service, Vector3(x=-move_increment, y=0, z=0))
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
            print("will move to the test position, drop, grab, return home and release")
            await move_absolute(my_arm_resource, motion_service, Pose(x=0.0, y=380, z=home_plane, o_x=0, o_y=0, o_z=-1, theta=0)) 
            await move_z(my_arm_resource, motion_service, grab_plane) 
            await grab(my_board, True)
            await home(my_arm_resource, motion_service) 
            await grab(my_board, False)

    # Don't forget to close the robot when you're done!
    await robot.close()

if __name__ == '__main__':
    asyncio.run(main())
