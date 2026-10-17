"""Offline joint authoring source. Runtime uses the separately validated bake."""
import bpy
import json
import math
import pathlib
import sys
from mathutils import Vector, Matrix

task_dir=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve()
parts=json.loads((task_dir/'parts.json').read_text(encoding='utf-8'))
for part in parts['parts']:part['file']=str(task_dir/part['file'])
walk_span=float(parts.get('motion',{}).get('walk',{}).get('spanPx',56))
walk_lift=float(parts.get('motion',{}).get('walk',{}).get('liftPx',14))
foot_centers=parts.get('motion',{}).get('walk',{}).get('footCentersPx',[232.5,232.5])
ground_ankles=parts['motion']['walk']['groundAnkleY']
assert 24<=walk_span<=128 and 6<=walk_lift<=24
assert len(foot_centers)==2 and all(200<=x<=260 for x in foot_centers)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.file_preview_type='NONE'
scene=bpy.context.scene
scene.name='ranger-layered-authoring-study'
scene.render.resolution_x,scene.render.resolution_y=480,448
scene.render.resolution_percentage=100
scene.render.fps=30
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.frame_start,scene.frame_end=1,61
scene['acceptance']='UNACCEPTED: layered authoring study; no production connection'
def point(p):return Vector((p[0]/100,0,(448-p[1])/100))
def pixel(v):return [v.x*100,448-v.z*100]
def add_bone(data,name,a,b,parent=None,connected=False,deform=True):
    bone=data.edit_bones.new(name)
    bone.head,bone.tail=point(a),point(b)
    bone.align_roll(Vector((0,-1,0)))
    if parent:bone.parent=data.edit_bones[parent]
    bone.use_connect=connected
    bone.use_deform=deform
    return bone
data=bpy.data.armatures.new('ranger-layered-bones')
rig=bpy.data.objects.new('ranger-layered-rig',data)
scene.collection.objects.link(rig)
rig.show_in_front=True
rig['production_connected']=False
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
add_bone(data,'root',[240,432],[240,408],deform=False)
add_bone(data,'pelvis',[232.5,228.5],[232.5,204.5],'root')
add_bone(data,'spine',[232.5,228.5],[230.5,112],'pelvis')
add_bone(data,'head',[230.5,112],[230.5,52],'spine')
legs=[{'hip':[224,227],'knee':[202,306],'ankle':[158,398],'toe':[194.75,427.4],'offset':.5},
      {'hip':[241,230],'knee':[260,307],'ankle':[290,398],'toe':[329.2,427.75],'offset':0}]
arms=[{'shoulder':[208,110],'elbow':[188,144],'wrist':[224,158],'grip':[244,173]},
      {'shoulder':[253,114],'elbow':[260,173],'wrist':[283,191],'grip':[293,203]}]
for i,leg in enumerate(legs):
    add_bone(data,f'leg-{i}-upper',leg['hip'],leg['knee'],'pelvis')
    add_bone(data,f'leg-{i}-lower',leg['knee'],leg['ankle'],f'leg-{i}-upper',True)
    add_bone(data,f'leg-{i}-foot',leg['ankle'],leg['toe'],f'leg-{i}-lower',True)
for i,arm in enumerate(arms):
    add_bone(data,f'arm-{i}-upper',arm['shoulder'],arm['elbow'],'spine')
    add_bone(data,f'arm-{i}-lower',arm['elbow'],arm['wrist'],f'arm-{i}-upper',True)
    add_bone(data,f'arm-{i}-hand',arm['wrist'],arm['grip'],f'arm-{i}-lower',True)
add_bone(data,'weapon-0',[244,173],[358,267],'arm-0-hand',True)
bpy.ops.object.mode_set(mode='OBJECT')
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
rig.select_set(False)

# Clothing meshes have explicit axial rings and authored two-bone weights.
# Other parts remain rigid. No full-body nearest-bone classification is used.
paint_meshes={}
mesh_definitions={}
for depth,name in enumerate(parts['order']):
    part=next(p for p in parts['parts'] if p['name']==name)
    mesh=bpy.data.meshes.new(name+'-paint-plane')
    is_clothing=part.get('kind')=='explicit-two-bone-pants'
    if is_clothing:
        hip,knee,ankle=[Vector(p) for p in [part['hip'],part['knee'],part['ankle']]]
        upper_length,lower_length=(knee-hip).length,(ankle-knee).length
        upper_axis,lower_axis=(knee-hip).normalized(),(ankle-knee).normalized()
        positions,weights=[],[]
        rings=[('upper',t) for t in [-.3,0,.2,.4,.6,.8,1]]+[('lower',t) for t in [.2,.4,.6,.8,1,1.2]]
        for segment,t in rings:
            axis=upper_axis if segment=='upper' else lower_axis
            if segment=='upper' and t==1:axis=(upper_axis+lower_axis).normalized()
            center=hip+(knee-hip)*t if segment=='upper' else knee+(ankle-knee)*t
            radius=44-12*max(0,t) if segment=='upper' else 32-12*t
            arc=upper_length*t if segment=='upper' else upper_length+lower_length*t
            half_width=part.get('blendHalfWidthPx',16)
            weight=max(0,min(1,(arc-upper_length+half_width)/(2*half_width)))
            weight=weight*weight*(3-2*weight)
            for lateral in [-1,-.5,0,.5,1]:
                positions.append(list(center+Vector((axis.y,-axis.x))*radius*lateral))
                weights.append(weight)
        faces=[]
        for row in range(len(rings)-1):
            for col in range(4):
                a=row*5+col;b=a+1;c=a+6;d=a+5
                faces.extend([(a,b,c),(a,c,d)])
        verts=[tuple(point(p)+Vector((0,-depth*.0001,0))) for p in positions]
        mesh.from_pydata(verts,[],faces)
        mesh_definitions[name]={'file':pathlib.Path(part['file']).name,'sourcePositions':positions,'triangles':faces}
    else:
        mesh.from_pydata([(0,-depth*.0001,0),(4.8,-depth*.0001,0),(4.8,-depth*.0001,4.48),(0,-depth*.0001,4.48)],[],[(0,1,2,3)])
    mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        vertex=mesh.vertices[loop.vertex_index].co
        mesh.uv_layers[0].data[loop.index].uv=(vertex.x/4.8,vertex.z/4.48)
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    if is_clothing:
        upper_group=obj.vertex_groups.new(name=part['upperBone'])
        lower_group=obj.vertex_groups.new(name=part['lowerBone'])
        for index,weight in enumerate(weights):
            if weight<1:upper_group.add([index],1-weight,'REPLACE')
            if weight>0:lower_group.add([index],weight,'REPLACE')
        paint_meshes[name]=obj
    else:obj.vertex_groups.new(name=part['bone']).add(range(4),1,'REPLACE')
    modifier=obj.modifiers.new('Explicit rigid painted layer','ARMATURE')
    modifier.object=rig
    modifier.use_deform_preserve_volume=True
    material=bpy.data.materials.new(name+'-approved-or-derived-paint')
    material.use_nodes=True
    material.surface_render_method='DITHERED'
    nodes=material.node_tree.nodes
    nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    mix=nodes.new('ShaderNodeMixShader')
    alpha=nodes.new('ShaderNodeBsdfTransparent')
    emission=nodes.new('ShaderNodeEmission')
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=bpy.data.images.load(part['file'],check_existing=True)
    texture.image.pack()
    links=material.node_tree.links
    links.new(texture.outputs['Alpha'],mix.inputs[0])
    links.new(alpha.outputs[0],mix.inputs[1])
    links.new(texture.outputs['Color'],emission.inputs['Color'])
    links.new(emission.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],output.inputs['Surface'])
    obj.data.materials.append(material)
    obj['source_sha256']=part['sha256']
    obj['original_pixels']=part.get('original',False)

camera_data=bpy.data.cameras.new('puppet-camera')
camera=bpy.data.objects.new('puppet-camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(2.4,-10,2.24)
camera.rotation_euler=(math.pi/2,0,0)
camera_data.type,camera_data.ortho_scale='ORTHO',4.8
scene.camera=camera
scene.view_settings.view_transform='Standard'

def oriented(bone,head,tail):
    rotation=(bone.tail_local-bone.head_local).rotation_difference(tail-head)
    return Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ bone.matrix_local.to_3x3().to_4x4()
def solve(upper,lower,hip,target):
    axis=target-hip
    distance=axis.length
    a,b=upper.length,lower.length
    if not abs(a-b)+1e-7<distance<a+b:raise ValueError(f'Unreachable target {upper.name}: {distance} outside {(abs(a-b),a+b)} frame {scene.frame_current} action {action_name}')
    axis/=distance
    along=(a*a+distance*distance-b*b)/(2*distance)
    height=math.sqrt(max(0,a*a-along*along))
    rest_axis=(lower.tail_local-upper.head_local).normalized()
    perpendicular=Vector((-axis.z,0,axis.x))
    rest_perpendicular=Vector((-rest_axis.z,0,rest_axis.x))
    sign=1 if (upper.tail_local-upper.head_local).dot(rest_perpendicular)>=0 else -1
    knee=hip+axis*along+perpendicular*height*sign
    return oriented(upper,hip,knee),oriented(lower,knee,target)
def transform2d(source,destination,angle=0):
    return Matrix.Translation(point(destination)) @ Matrix.Rotation(angle,4,'Y') @ Matrix.Translation(-point(source))
def smooth(t):return max(0,min(1,t))**2*(3-2*max(0,min(1,t)))
def set_pose(matrices,frame):
    for bone in data.bones:
        if bone.name not in matrices:
            matrices[bone.name]=matrices[bone.parent.name] @ bone.parent.matrix_local.inverted() @ bone.matrix_local
        parent=matrices[bone.parent.name] @ bone.parent.matrix_local.inverted() if bone.parent else Matrix.Identity(4)
        pose=rig.pose.bones[bone.name]
        pose.matrix_basis=(parent @ bone.matrix_local).inverted() @ matrices[bone.name]
        for channel in ['location','rotation_quaternion','scale']:pose.keyframe_insert(data_path=channel,frame=frame,group=bone.name)

report={'status':'UNACCEPTED: explicit painted layers driven by actual Blender bones; visual review pending','motion':{'walk':{'spanPx':walk_span,'liftPx':walk_lift,'stanceFraction':.62,'footCentersPx':foot_centers}},'meshDefinitions':mesh_definitions,'actions':[]}
for action_name,settle in [('walk',0),('settle-1',1/3),('settle-2',2/3),('settle-3',1),('attack',1)]:
    walking=action_name!='attack'
    rig.animation_data_clear()
    for frame in range(1,62):
        phase=(frame-1)/60
        scene.frame_set(frame)
        travel=(walk_span/.62*phase) if walking else 0
        bob=1.2*math.cos(phase*4*math.pi)*(1-settle) if walking else 0
        body=Matrix.Translation(Vector((travel/100,0,-bob/100)))
        root=Matrix.Translation(Vector((travel/100,0,0)))
        matrices={'root':root@data.bones['root'].matrix_local}
        for name in ['pelvis','spine','head']:matrices[name]=body@data.bones[name].matrix_local
        for i,leg in enumerate(legs):
            q=(phase+leg['offset'])%1
            if walking:
                if q<=.62:x,lift,angle=walk_span*(.5-q/.62),0,0
                else:
                    t=(q-.62)/.38
                    x,lift,angle=walk_span*(-.5+smooth(t)),walk_lift*math.sin(math.pi*t)*(1-settle),-.16*math.sin(math.pi*t)*(1-settle)
                target=point([foot_centers[i]+travel+x,ground_ankles[i]-lift])
            else:target,angle=point([foot_centers[i]+walk_span*(.5-(.5 if i==0 else 0)/.62),ground_ankles[i]]),0
            upper,lower=data.bones[f'leg-{i}-upper'],data.bones[f'leg-{i}-lower']
            hip=body@upper.head_local
            matrices[upper.name],matrices[lower.name]=solve(upper,lower,hip,target)
            foot=data.bones[f'leg-{i}-foot']
            matrices[foot.name]=Matrix.Translation(target) @ Matrix.Rotation(angle,4,'Y') @ foot.matrix_local.to_3x3().to_4x4()
        if action_name=='attack':
            amount=smooth(phase/.28) if phase<.28 else 1 if phase<.7 else 1-smooth((phase-.7)/.3)
            recoil=5*math.sin(math.pi*(phase-.28)/.13) if .28<=phase<=.41 else 0
            weapon=transform2d([244,173],[244+21*amount-recoil,173-33*amount],-math.atan2(94,114)*amount)
        else:weapon=body
        for i,arm in enumerate(arms):
            upper,lower=data.bones[f'arm-{i}-upper'],data.bones[f'arm-{i}-lower']
            shoulder=body@upper.head_local
            wrist=weapon@point(arm['wrist'])
            matrices[upper.name],matrices[lower.name]=solve(upper,lower,shoulder,wrist)
            matrices[f'arm-{i}-hand']=weapon@data.bones[f'arm-{i}-hand'].matrix_local
        matrices['weapon-0']=weapon@data.bones['weapon-0'].matrix_local
        set_pose(matrices,frame)
    action=rig.animation_data.action
    action.name='ranger-'+action_name+'-layered-study'
    action.use_fake_user=True
    samples=[]
    for frame in range(1,62):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        sample={'frame':frame,'bones':{},'deform':{},'meshes':{}}
        for bone in evaluated.pose.bones:
            sample['bones'][bone.name]={'head':pixel(bone.head),'tail':pixel(bone.tail)}
            matrix=bone.matrix@bone.bone.matrix_local.inverted()
            # Read the linear transform directly. Subtracting two nearly
            # identical float32 transformed points loses subpixel accuracy.
            sample['deform'][bone.name]=[matrix[0][0],-matrix[2][0],-matrix[0][2],matrix[2][2],
                448*matrix[0][2]+100*matrix[0][3],448-448*matrix[2][2]-100*matrix[2][3]]
        for name,obj in paint_meshes.items():
            evaluated_paint=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            sample['meshes'][name]=[pixel(evaluated_paint.matrix_world@vertex.co) for vertex in evaluated_paint.data.vertices]
        samples.append(sample)
    report['actions'].append({'name':action_name,'frames':samples})
rig.animation_data.action=bpy.data.actions['ranger-walk-layered-study']
scene.frame_set(1)
destination=task_dir/'ranger-layered-authoring.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
(task_dir/'blender-motion.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'saved':str(destination),'parts':len(parts['order']),'actions':[a['name'] for a in report['actions']],'status':report['status']}),flush=True)
