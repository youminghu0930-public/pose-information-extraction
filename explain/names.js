// Shared product vocabulary. Export keys stay stable; labels can change here.
export const typeNames={kinematic:'Body rotations',geometric:'Geometric angles',position:'Hip displacement'};
export const subtypeNames={
 torso_turn_bend_tilt:'Torso turn, forward bend and side tilt — shoulders and upper spine',
 hip_turn_on_spine_plane:'Hip rotation around the lower spine',
 shoulder_turn_on_spine_plane:'Shoulder rotation around the lower spine',
 shoulder_turn_tilt:'Shoulder-line turn and tilt',hip_turn_tilt:'Hip-line turn and tilt',
 spine_bend_tilt:'Spine forward bend and side tilt',spine_azimuth_polar_spin:'Spine lean direction, inclination and twist',
 hip_sway_thrust_lift:'Hip displacement',
};
export const itemNames={turn:'Turn',bend:'Forward bend',tilt:'Side tilt',azimuth:'Lean direction',polar:'Lean from vertical',spin:'Twist around the spine',sway:'Sideways displacement',thrust:'Forward displacement',lift:'Vertical displacement'};
export const jointNames={root:'Hip center',torso:'Spine midpoint',clavicle:'Shoulder center',left_shoulder:'Left shoulder',right_shoulder:'Right shoulder',left_hip:'Left hip',right_hip:'Right hip',left_ankle:'Left ankle',right_ankle:'Right ankle'};
export const axisNames=['X · right to left','Y · up','Z · forward'];
export const label=(dictionary,key)=>dictionary[key]??key.replaceAll('_',' ');

// Header descriptions distinguish similar metrics without exposing export keys.
export const subtypeDescriptions={
 torso_turn_bend_tilt:'The shoulders define the torso’s left–right direction, and the upper spine defines up. Compare this frame with the reference-pose axes, then rotate through turn, forward bend and side tilt in that order.',
 hip_turn_on_spine_plane:'Use the lower spine as the rotation axis. Project the hip line and the reference left–right direction onto the plane across that axis, then compare their directions.',
 shoulder_turn_on_spine_plane:'Use the lower spine as the rotation axis. Project the shoulder line and the reference left–right direction onto the plane across that axis, then compare their directions.',
 shoulder_turn_tilt:'Follow the line from the right shoulder to the left shoulder. Its direction across the reference horizontal plane gives turn; its angle above or below that plane gives tilt.',
 hip_turn_tilt:'Follow the line from the right hip to the left hip. Its direction across the reference horizontal plane gives turn; its angle above or below that plane gives tilt.',
 spine_bend_tilt:'Follow the spine from the hip center to the shoulder center. For forward bend, compare it with its projection onto the sideways–up plane. For side tilt, compare it with its projection onto the forward–up plane.',
 spine_azimuth_polar_spin:'Use the hip-to-shoulder spine direction to show where the body leans and how far it leans from reference up. Then compare the shoulder direction around that spine to show twist.',
 hip_sway_thrust_lift:'Keep the reference ankle midpoint as the origin and use the saved body scale to normalize distance. Compare the selected hip center with the reference hip center to show sideways, forward and upward movement.',
};
subtypeNames.torso_turn_bend_tilt_by_shoulder=subtypeNames.torso_turn_bend_tilt;
subtypeDescriptions.torso_turn_bend_tilt_by_shoulder=subtypeDescriptions.torso_turn_bend_tilt;
