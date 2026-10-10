"""Explicit per-limb Blender authoring; no automatic full-body segmentation."""
import bpy
import json
import math
import pathlib
import sys
from mathutils import Vector, Matrix

task=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve()
parts=json.loads((task/'parts.json').read_text(encoding='utf-8'))
for part in parts['parts']:part['file']=str(task/part['file'])
spec=parts['rig'];kind=parts['kind'];legs=spec['legs'];arms=spec.get('arms',[])
walk=parts['motion']['walk'];span=float(walk['spanPx']);lift=float(walk['liftPx']);stance=float(walk['stanceFraction'])
assert 0<stance<1 and 0<span<=128 and 0<lift<=24
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.file_preview_type='NONE'
scene=bpy.context.scene;scene.name=kind+'-explicit-layer-study'
scene.render.resolution_x,scene.render.resolution_y=480,448
scene.render.resolution_percentage=100;scene.render.fps=30
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.frame_start,scene.frame_end=1,61
scene['production_connected']=False
def point(p):return Vector((p[0]/100,0,(448-p[1])/100))
def pixel(v):return [v.x*100,448-v.z*100]
data=bpy.data.armatures.new(kind+'-explicit-bones')
rig=bpy.data.objects.new(kind+'-layered-rig',data);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None,connected=False,deform=True):
    result=data.edit_bones.new(name);result.head,result.tail=point(a),point(b)
    result.align_roll(Vector((0,-1,0)));result.use_connect=connected;result.use_deform=deform
    if parent:result.parent=data.edit_bones[parent]
    return result
root=spec['root'];bone('root',root,[root[0],root[1]-24],deform=False)
bone('pelvis',*spec['pelvis'],'root');bone('spine',*spec['spine'],'pelvis');bone('head',*spec['head'],'spine')
for extra in spec.get('extras',[]):bone(extra['name'],extra['a'],extra['b'],extra['parent'])
for i,l in enumerate(legs):
    bone(f'leg-{i}-upper',l['hip'],l['knee'],'pelvis')
    bone(f'leg-{i}-lower',l['knee'],l['ankle'],f'leg-{i}-upper',True)
    bone(f'leg-{i}-foot',l['ankle'],l['toe'],f'leg-{i}-lower',True)
for i,a in enumerate(arms):
    bone(f'arm-{i}-upper',a['shoulder'],a['elbow'],'spine')
    bone(f'arm-{i}-lower',a['elbow'],a['wrist'],f'arm-{i}-upper',True)
    bone(f'arm-{i}-hand',a['wrist'],a['grip'],f'arm-{i}-lower',True)
for weapon in spec.get('weapons',[]):bone(weapon['name'],weapon['a'],weapon['b'],'spine')
bpy.ops.object.mode_set(mode='OBJECT')
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
rig.select_set(False)
paint_meshes={};mesh_definitions={}
for depth,name in enumerate(parts['order']):
    part=next(p for p in parts['parts'] if p['name']==name)
    mesh=bpy.data.meshes.new(name+'-explicit-paint')
    deform=part.get('kind')=='explicit-two-bone-limb'
    if deform:
        hip,knee,ankle=map(Vector,[part['hip'],part['knee'],part['ankle']])
        al,bl=(knee-hip).length,(ankle-knee).length;aa,ba=(knee-hip).normalized(),(ankle-knee).normalized()
        positions=[];weights=[];radii=part['radii']
        rings=[('upper',t) for t in [-.3,0,.2,.4,.6,.8,1]]+[('lower',t) for t in [.2,.4,.6,.8,1,1.2]]
        for segment,t in rings:
            axis=aa if segment=='upper' else ba
            if segment=='upper' and t==1:axis=(aa+ba).normalized()
            center=hip+(knee-hip)*t if segment=='upper' else knee+(ankle-knee)*t
            radius=radii[0]+(radii[1]-radii[0])*max(0,t) if segment=='upper' else radii[1]+(radii[2]-radii[1])*t
            arc=al*t if segment=='upper' else al+bl*t;half=part['blendHalfWidthPx']
            w=max(0,min(1,(arc-al+half)/(2*half)));w=w*w*(3-2*w)
            for lateral in [-1,-.5,0,.5,1]:positions.append(list(center+Vector((axis.y,-axis.x))*radius*lateral));weights.append(w)
        faces=[]
        for row in range(len(rings)-1):
            for col in range(4):
                a=row*5+col;b=a+1;c=a+6;d=a+5;faces.extend([(a,b,c),(a,c,d)])
        mesh.from_pydata([tuple(point(p)+Vector((0,-depth*.0001,0))) for p in positions],[],faces)
        mesh_definitions[name]={'file':part['file'],'sourcePositions':positions,'triangles':faces}
    else:mesh.from_pydata([(0,-depth*.0001,0),(4.8,-depth*.0001,0),(4.8,-depth*.0001,4.48),(0,-depth*.0001,4.48)],[],[(0,1,2,3)])
    mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        p=mesh.vertices[loop.vertex_index].co;mesh.uv_layers[0].data[loop.index].uv=(p.x/4.8,p.z/4.48)
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    if deform:
        upper=obj.vertex_groups.new(name=part['upperBone']);lower=obj.vertex_groups.new(name=part['lowerBone'])
        for i,w in enumerate(weights):
            if w<1:upper.add([i],1-w,'REPLACE')
            if w>0:lower.add([i],w,'REPLACE')
        paint_meshes[name]=obj
    else:obj.vertex_groups.new(name=part['bone']).add(range(4),1,'REPLACE')
    modifier=obj.modifiers.new('Explicit authored weights','ARMATURE');modifier.object=rig;modifier.use_deform_preserve_volume=True
    mat=bpy.data.materials.new(name+'-source-paint');mat.use_nodes=True;mat.surface_render_method='DITHERED'
    nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
    out=nodes.new('ShaderNodeOutputMaterial');mix=nodes.new('ShaderNodeMixShader')
    transparent=nodes.new('ShaderNodeBsdfTransparent');emission=nodes.new('ShaderNodeEmission');texture=nodes.new('ShaderNodeTexImage')
    texture.image=bpy.data.images.load(part['file'],check_existing=True);texture.image.pack()
    links.new(texture.outputs['Alpha'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1])
    links.new(texture.outputs['Color'],emission.inputs['Color']);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    obj.data.materials.append(mat);obj['source_sha256']=part['sha256'];obj['original_pixels']=part.get('original',False)
camera_data=bpy.data.cameras.new('offline-camera');camera=bpy.data.objects.new('offline-camera',camera_data)
scene.collection.objects.link(camera);camera.location=(2.4,-10,2.24);camera.rotation_euler=(math.pi/2,0,0)
camera_data.type,camera_data.ortho_scale='ORTHO',4.8;scene.camera=camera;scene.view_settings.view_transform='Standard'
def oriented(b,head,tail):
    q=(b.tail_local-b.head_local).rotation_difference(tail-head)
    return Matrix.Translation(head)@q.to_matrix().to_4x4()@b.matrix_local.to_3x3().to_4x4()
def solve(upper,lower,hip,target):
    axis=target-hip;d=axis.length;a,b=upper.length,lower.length
    if not abs(a-b)+1e-7<d<a+b:raise ValueError(f'Unreachable {upper.name}: distance={d}, reach={a+b}, frame={scene.frame_current}, action={action_name}')
    axis/=d;along=(a*a+d*d-b*b)/(2*d);height=math.sqrt(max(0,a*a-along*along))
    rest=(lower.tail_local-upper.head_local).normalized();side=Vector((-axis.z,0,axis.x));rest_side=Vector((-rest.z,0,rest.x))
    sign=1 if (upper.tail_local-upper.head_local).dot(rest_side)>=0 else -1
    knee=hip+axis*along+side*height*sign
    return oriented(upper,hip,knee),oriented(lower,knee,target)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def transform(source,destination,angle=0):return Matrix.Translation(point(destination))@Matrix.Rotation(angle,4,'Y')@Matrix.Translation(-point(source))
def set_pose(matrices,frame):
    for b in data.bones:
        if b.name not in matrices:matrices[b.name]=matrices[b.parent.name]@b.parent.matrix_local.inverted()@b.matrix_local
        parent=matrices[b.parent.name]@b.parent.matrix_local.inverted() if b.parent else Matrix.Identity(4)
        p=rig.pose.bones[b.name];p.matrix_basis=(parent@b.matrix_local).inverted()@matrices[b.name]
        for channel in ['location','rotation_quaternion','scale']:p.keyframe_insert(data_path=channel,frame=frame,group=b.name)
report={'kind':kind,'status':'UNACCEPTED; actual Blender data, no production integration','motion':walk,'rig':spec,'meshDefinitions':mesh_definitions,'actions':[]}
for action_name in ['walk','settle-1','settle-2','settle-3','attack']:
    rig.animation_data_clear()
    walking=action_name!='attack';settle=int(action_name[-1])/3 if action_name.startswith('settle-') else 0
    for frame in range(1,62):
        phase=(frame-1)/60;scene.frame_set(frame);amount=0;anticipation=0
        if not walking:
            if phase<=.18:anticipation=smooth(phase/.18)
            elif phase<=.28:anticipation=1-smooth((phase-.18)/.10);amount=1-anticipation
            elif phase<=.55:amount=1
            else:amount=1-smooth((phase-.55)/.45)
        travel=span/stance*phase if walking else 0;bob=1.2*math.cos(phase*4*math.pi)*(1-settle) if walking else 0
        body=Matrix.Translation(Vector(((travel+4*amount-3*anticipation)/100,0,-bob/100)))
        matrices={'root':Matrix.Translation(Vector((travel/100,0,0)))@data.bones['root'].matrix_local}
        for name in ['pelvis','spine','head']:matrices[name]=body@data.bones[name].matrix_local
        for extra in spec.get('extras',[]):
            matrices[extra['name']]=body@transform(extra['a'],extra['a'],extra.get('walkAngle',0)*math.sin(phase*2*math.pi) if action_name=='walk' else 0)@data.bones[extra['name']].matrix_local
        for i,l in enumerate(legs):
            q=(phase+l.get('offset',0))%1
            if walking:
                if q<=stance:x,y,angle=span*(.5-q/stance),0,0
                else:
                    t=(q-stance)/(1-stance);tangent=-span/stance*(1-stance)
                    x=span*(-.5+smooth(t))+tangent*(2*t*t*t-3*t*t+t)
                    y,angle=lift*math.sin(math.pi*t)*(1-settle),-.16*math.sin(math.pi*t)*(1-settle)
            else:x,y,angle=0,0,0
            target=point([l['center']+travel+x,l.get('groundAnkleY',l['ankle'][1])-y]);upper,lower=data.bones[f'leg-{i}-upper'],data.bones[f'leg-{i}-lower']
            matrices[upper.name],matrices[lower.name]=solve(upper,lower,body@upper.head_local,target)
            foot=data.bones[f'leg-{i}-foot'];matrices[foot.name]=Matrix.Translation(target)@Matrix.Rotation(angle,4,'Y')@foot.matrix_local.to_3x3().to_4x4()
        weapon_transforms={}
        for weapon in spec.get('weapons',[]):
            grip=weapon['a']
            if walking:
                swing=math.sin(phase*2*math.pi)*(1-settle)
                w=body@transform(grip,[grip[0]+8*swing,grip[1]-2*abs(swing)],-.05*swing)
            else:
                destination=[grip[0]-13*anticipation+83*amount,grip[1]-30*anticipation-92*amount]
                w=body@transform(grip,destination,-.7*anticipation-.45*amount)
            weapon_transforms[weapon['armIndex']]=w;matrices[weapon['name']]=w@data.bones[weapon['name']].matrix_local
        for i,a in enumerate(arms):
            if i in weapon_transforms:hand=weapon_transforms[i]
            else:
                swing=math.sin((phase+a.get('walkPhaseOffset',.5))*2*math.pi)*(1-settle) if walking else 0
                claw=spec.get('attack',{}).get('armTargets')
                if claw and not walking:
                    target=claw[i]
                    base=a.get('walkWrist',a['wrist'])
                    dest=[base[0]-13*anticipation+(target[0]-base[0])*amount,base[1]-10*anticipation+(target[1]-base[1])*amount]
                    angle=spec['attack']['handAngles'][i]*amount+.15*anticipation
                else:
                    base=a.get('walkWrist',a['wrist']) if walking else a['wrist']
                    dest=[base[0]+a.get('walkSwingPx',12)*swing-10*anticipation+10*amount,base[1]-a.get('walkLiftPx',3)*abs(swing)-18*anticipation-16*amount]
                    angle=.16*swing
                hand=body@transform(a['wrist'],dest,angle)
            upper,lower=data.bones[f'arm-{i}-upper'],data.bones[f'arm-{i}-lower'];matrices[upper.name],matrices[lower.name]=solve(upper,lower,body@upper.head_local,hand@point(a['wrist']))
            matrices[f'arm-{i}-hand']=hand@data.bones[f'arm-{i}-hand'].matrix_local
        set_pose(matrices,frame)
    action=rig.animation_data.action;action.name=kind+'-'+action_name+'-layered-study';action.use_fake_user=True;samples=[]
    for frame in range(1,62):
        scene.frame_set(frame);bpy.context.view_layer.update();evaluated=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());sample={'frame':frame,'bones':{},'deform':{},'meshes':{}}
        for b in evaluated.pose.bones:
            sample['bones'][b.name]={'head':pixel(b.head),'tail':pixel(b.tail)};m=b.matrix@b.bone.matrix_local.inverted()
            sample['deform'][b.name]=[m[0][0],-m[2][0],-m[0][2],m[2][2],448*m[0][2]+100*m[0][3],448-448*m[2][2]-100*m[2][3]]
        for name,obj in paint_meshes.items():
            p=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());sample['meshes'][name]=[pixel(p.matrix_world@v.co) for v in p.data.vertices]
        samples.append(sample)
    report['actions'].append({'name':action_name,'frames':samples})
rig.animation_data.action=bpy.data.actions[kind+'-walk-layered-study'];scene.frame_set(1)
destination=task/(kind+'-layered-authoring.blend');bpy.ops.wm.save_as_mainfile(filepath=str(destination))
(task/'blender-motion.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'saved':str(destination),'parts':len(parts['order']),'actions':[a['name'] for a in report['actions']],'status':report['status']}),flush=True)
