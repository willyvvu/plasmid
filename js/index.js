var Plasmid = function(canvascontainer) {
	this.projector = new THREE.Projector();
	//The container for the canvas which will be rendered on
	this.canvascontainer = canvascontainer;
	//Timing
	this.deltaTime = 0;
	this.lastLoop = 0;
	this.currentTime = 0;
	//Resizing
	this.size = new THREE.Vector3();
	//References to important objects
	this.renderer = null;
	this.scene = null;
	this.camera = null;
	this.composer = null;
	//Whether or not to use the post-processing chain
	this.usePostProcess = true;
	this.useparticles = true;
	//Constants
	this.LOADING = 0;
	this.MAIN = 1;
	this.LEVELSELECT = 2;
	this.LEVEL = 3;
	this.ARCADE = 4;
	this.lerpspeed = 0.05; //How fast to lerp
	//Defines the current visible screen
	this.state = this.LOADING;
	//Contains information for the loading screen
	this.loading = {
		loadedColor: new THREE.Color(0xFFFFFF),
		waitingColor: new THREE.Color(0x555555)
	}
	//Contains objects that make up the main menu, along with the menu state
	this.mainmenu = {
		logo: {
			object: null,
			material: null
		}
	}
	//Contains objects that constitute the background, as well as their settings
	this.ambient = {
		rays: {
			object: null,
			material: new THREE.MeshBasicMaterial({
				blending: THREE.AdditiveBlending,
				opacity: 0.1,
				transparent: true
			}),
			geometry: null,
			raySpeed: 0.02 //How fast the rays move
		},
		particles: {
			object: null,
			boxSize: new THREE.Vector3(1500, 1000, 1000),
			geometry: new THREE.BufferGeometry(),
			numParticles: 256,
			toMaxVelocity: 15,
			minVelocity: 1,
			material: new THREE.ShaderMaterial({
				transparent: true,
				blending: THREE.AdditiveBlending,
				//depthWrite: false,
				uniforms: {
					"opacity": {
						"type": "f",
						"value": 0.3
					},
					"map": {
						"type": "t",
						"value": null
					},
					"size": {
						"type": "f",
						"value": 10
					},
					"scale": {
						"type": "f",
						"value": 512
					},
					"boxSize": {
						"type": "v3",
						"value": new THREE.Vector3(0, 0, 0)
					},
					"time": {
						"type": "f",
						"value": 0
					}
				},
				attributes: {
					"velocity": {
						"type": "f",
						"value": null
					}
				},
				vertexShader: [
					"uniform float size;",
					"uniform float scale;",
					"uniform float time;",
					"uniform vec3 boxSize;",
					"attribute float velocity;",
					"void main(){",
					"vec3 pos=position;",
					"pos.y+=time*velocity;",
					"pos.x=mod(pos.x,boxSize.x)-boxSize.x*0.5;",
					"pos.y=mod(pos.y,boxSize.y)-boxSize.y*0.5;",
					"pos.z=mod(pos.z,boxSize.z)-boxSize.z*0.5;",
					"vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );",
					"gl_PointSize = size * ( scale / length( mvPosition.xyz ) );",
					"gl_Position = projectionMatrix * mvPosition;",
					"}"
				].join("\n"),
				fragmentShader: [
					"uniform float opacity;",
					"uniform sampler2D map;",
					"void main() {",
					"gl_FragColor = texture2D( map, vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y ) );",
					"gl_FragColor.w *= opacity;",
					"}"
				].join("\n")
			})
		},
		background: {
			object: null,
			material: new THREE.MeshBasicMaterial({
				color: 0xFFFFFF,
				vertexColors: THREE.VertexColors
			}),
			geometry: null,
			colorBottom: new THREE.Color(),
			colorTop: new THREE.Color()
		}
	}
	//Defines constants for interaction and the camera
	this.interaction = {
		maxHeight: 0, //The (approximate) maximum visible height of the interaction plane when viewed through the camera
		interactionDistance: 25, //The z-distance from the origin of interactable objects
		defaultViewDistance: 1000, //The default z-distance from the origin of the camera
		adjustedProjectionDistance: 60, //The compensation factor for the approximate inverse projection
		cursor: {
			position: new THREE.Vector3(),
			projected: new THREE.Vector3(),
			visible: false,
			down: false,
			handleUp: false,
			handleMove: false,
			handleDown: false,
			handleVisibility: false
		},
		selection: {
			nearest: null, //Used by level_nearest()
			nearestDistance: Infinity, //Used by level_nearest()
			distance: 150, //Minimum distance in order to select.
			selecting: false,
			fromHandle: null,
			toHandle: null
		}
	}
	//Defines the current camera field of view and look-at target
	this.view = {
		fov: 45, //The field of view of the camera
		near: 0.1, //The near value of the camera
		far: 10000, //The far value of the camera
		lookAt: new THREE.Vector3(0, 0, 0), //Where the camera should look (lerped)
		_lookAt: new THREE.Vector3(0, 0, 0), //Where the camera should look
		position: new THREE.Vector3(0, 0, this.interaction.defaultViewDistance), //The camera's intended position (lerped)
		_position: new THREE.Vector3(0, 0, this.interaction.defaultViewDistance), //The camera's intended position
		tilt: new THREE.Vector3(0, 0, 0),
		_tilt: new THREE.Vector3(0, 0, 0),
		maxTilt: 100, //The max amount to tilt
		defaultspeed: 0.05, //How fast to change, by default
		tiltspeed: 0.1, //How fast to change on device orientation, by default
		returnspeed: 0.02, //How fast to return to the cursor
		returning: false, //Returning to the cursor?
		snap: 0, //The speed to transition the tilt
	}
	//Defines which image assets are needed, and stores them once loaded.
	this.images = {
		source: {
			particle: "Particle.png",
			logo: "Logo.png",
			rays: "Rays.png",
			handle: "Handle.png"
		},
		logoSize: 450,
		handleSize: 80,
		count: 0,
		loaded: 0
	}
	//Defines shaders for use with post-processing.
	this.shaders = {
		vignette: {
			uniforms: {
				"tDiffuse": {
					type: "t",
					value: null
				}
			},
			vertexShader: [
				"varying vec2 vUv;",
				"void main() {",
				"vUv = uv;",
				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
				"}"
			].join("\n"),
			fragmentShader: [
				"uniform sampler2D tDiffuse;",
				"varying vec2 vUv;",
				"void main() {",
				"float toCenter=length(vUv-vec2(0.5,0.5));",
				"gl_FragColor=texture2D(tDiffuse,vUv)*clamp(1.2-toCenter,0.0,1.0);",
				"}"
			].join("\n")
		},
		chromaticAbberation: {
			uniforms: {
				"tDiffuse": {
					type: "t",
					value: null
				},
				"amount": {
					type: "f",
					value: 0.999
				}
			},
			vertexShader: [
				"varying vec2 vUv;",
				"void main() {",
				"vUv = uv;",
				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
				"}"
			].join("\n"),
			fragmentShader: [
				"uniform sampler2D tDiffuse;",
				"uniform float amount;",
				"varying vec2 vUv;",
				"void main(){",
				"gl_FragColor=texture2D(tDiffuse,vUv);",
				"gl_FragColor.y=texture2D(tDiffuse,vec2(0.5,0.5)+(vUv+vec2(-0.5,-0.5))*amount).y;",
				"gl_FragColor.z=texture2D(tDiffuse,vec2(0.5,0.5)+(vUv+vec2(-0.5,-0.5))*(1.0/amount)).z;",
				"}",
			].join("\n")
		},
		fxaa: {
			uniforms: {
				"tDiffuse": {
					type: "t",
					value: null
				},
				"resolution": {
					type: "v3",
					value: this.size
				}
			},
			vertexShader: [
				"varying vec2 vUv;",
				"void main() {",
				"vUv = uv;",
				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
				"}"
			].join("\n"),
			fragmentShader: [
				"uniform sampler2D tDiffuse;",
				"uniform vec3 resolution;",
				"varying vec2 vUv;",

				"void main() {",

				"float FXAA_SPAN_MAX = 8.0;",
				"float FXAA_REDUCE_MUL = 1.0/8.0;",
				"float FXAA_REDUCE_MIN = (1.0/128.0);",

				"vec2 invSize = vec2(1.0/resolution.x, 1.0/resolution.y);",

				"vec3 rgbNW = texture2D(tDiffuse, vUv + (vec2(-1.0, -1.0) * invSize)).xyz;",
				"vec3 rgbNE = texture2D(tDiffuse, vUv + (vec2(+1.0, -1.0) * invSize)).xyz;",
				"vec3 rgbSW = texture2D(tDiffuse, vUv + (vec2(-1.0, +1.0) * invSize)).xyz;",
				"vec3 rgbSE = texture2D(tDiffuse, vUv + (vec2(+1.0, +1.0) * invSize)).xyz;",
				"vec3 rgbM  = texture2D(tDiffuse, vUv).xyz;",

				"vec3 luma = vec3(0.299, 0.587, 0.114);",
				"float lumaNW = dot(rgbNW, luma);",
				"float lumaNE = dot(rgbNE, luma);",
				"float lumaSW = dot(rgbSW, luma);",
				"float lumaSE = dot(rgbSE, luma);",
				"float lumaM  = dot( rgbM, luma);",

				"float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));",
				"float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));",

				"vec2 dir;",
				"dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));",
				"dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));",

				"float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);",

				"float rcpDirMin = 1.0/(min(abs(dir.x), abs(dir.y)) + dirReduce);",

				"dir = min(vec2(FXAA_SPAN_MAX,  FXAA_SPAN_MAX), ",
				"max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * invSize;",

				"vec3 rgbA = (1.0/2.0) * (",
				"texture2D(tDiffuse, vUv + dir * (1.0/3.0 - 0.5)).xyz +",
				"texture2D(tDiffuse, vUv + dir * (2.0/3.0 - 0.5)).xyz);",
				"vec3 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (",
				"texture2D(tDiffuse, vUv + dir * (0.0/3.0 - 0.5)).xyz +",
				"texture2D(tDiffuse, vUv + dir * (3.0/3.0 - 0.5)).xyz);",
				"float lumaB = dot(rgbB, luma);",

				"if((lumaB < lumaMin) || (lumaB > lumaMax)){",
				"gl_FragColor.xyz=rgbA;",
				"} else {",
				"gl_FragColor.xyz=rgbB;",
				"}",
				"gl_FragColor.a = 1.0;",
				"}"
			].join("\n")
		}
	}
	//Contains data for each level and level pack. Time to call in the level designers!
	this.levelpacks = [{
		ambient: {
			//music:"",
			background: {
				colorTop: new THREE.Color(0x00DD00),
				colorBottom: new THREE.Color(0x002200)
			},
			palette: [
				new THREE.Color(0x00FF00),
				new THREE.Color(0x00AA00),
				new THREE.Color(0x77FF77)
			]
		},
		levels: [{
			segments: [{
				from: 1,
				to: 0
			}, {
				from: 1,
				to: 2
			}, {
				from: 2,
				to: 0
			}],
			locations: [
				[0, 1, 2]
			]
		}]
	}, {
		ambient: {
			//music:"",
			background: {
				colorTop: new THREE.Color(0xDD0000),
				colorBottom: new THREE.Color(0xFFEE00)
			},
			palette: [
				new THREE.Color(0xFF9900),
				new THREE.Color(0xBB0000),
				new THREE.Color(0xFFFF00)
			]
		},
		levels: [{
			segments: [{
				from: 0,
				to: 1
			}, {
				from: 1,
				to: 2
			}, {
				from: 2,
				to: 0
			}, {
				from: 0,
				to: 1
			}, {
				from: 1,
				to: 0
			}],
			locations: [
				[{
					segment: 2,
				}, {
					segment: 1,
				}, {
					segment: 3,
					reversed: true
				}, {
					segment: 0,
					reversed: true
				}, {
					segment: 4
				}]
			]
		}]
	}, {
		ambient: {
			//music:"",
			background: {
				colorTop: new THREE.Color(0xCC00CC),
				colorBottom: new THREE.Color(0xFFFF00)
			},
			palette: [
				new THREE.Color(0xCC00CC),
				new THREE.Color(0xFFDD00),
				new THREE.Color(0xDDDD00)
			]
		},
		levels: []
	}]
	//Contains the state of the current level and necessary data to show the level
	this.current = {
		segments: [], //An array holding the current segments and their meshes that are needed for the current level
		pack: null, //A reference to the current (game data) level pack
		level: null, //A reference to the current (game data) level
		save: null, //A reference to the save data to the current level, containing location and history
		handles: [] //An array holding all handle objects
	}
	//Contains assets and settings relevant the level ring and UI
	this.level = {
		object: new THREE.Object3D(), //The object that holds the entire level.
		handle: {
			handleHeight: 25,
			material: new THREE.MeshBasicMaterial({
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false
			})
		},
		ring: {
			subdivisions: 32, //How many sections to split each segment into
			separation: 0.3, //How many radians to keep between segments
			minRadius: 300, //The minimum (inside) radius of the ring
			thickness: 50, //The thickness of the ring
			concentric: -140, //The gap between concentric rings
			offset: 0.2, //The offset (in radians) between concentric rings
			lerpspeed: 0.1, //How fast to switch segments
			materialSettings: {
				color: 0xFFFFFF,
				//vertexColors: THREE.VertexColors,
				side: THREE.DoubleSide,
				transparent: true,
				//blending: THREE.AdditiveBlending,
				uniforms: {
					"opacity": {
						"type": "f",
						"value": 1
					},
					"startAngle": {
						type: "f",
						value: 0
					},
					"deltaAngle": {
						type: "f",
						value: 0
					},
					"startRadius": {
						type: "f",
						value: 0
					},
					"deltaRadius": {
						type: "f",
						value: 0
					},
					"fromColor": {
						type: "c",
						value: new THREE.Color(0xFFFFFF)
					},
					"toColor": {
						type: "c",
						value: new THREE.Color(0xFFFFFF)
					}
				},

				vertexShader: [
					"uniform float startAngle;",
					"uniform float deltaAngle;",
					"uniform float startRadius;",
					"uniform float deltaRadius;",
					"uniform vec3 fromColor;",
					"uniform vec3 toColor;",
					"varying vec3 vColor;",
					//THREE.ShaderChunk["color_pars_vertex"],

					"void main() {",

					"float radius=startRadius+deltaRadius*position.y;",
					"float theta=startAngle+deltaAngle*position.x;",

					//THREE.ShaderChunk["color_vertex"],
					"vColor = fromColor*(1.0-position.x)+toColor*position.x;",

					"gl_Position = projectionMatrix * modelViewMatrix * vec4( radius * cos(theta), radius * sin(theta), position.z, 1.0 );",
					//THREE.ShaderChunk["default_vertex"],

					"}"

				].join("\n"),

				fragmentShader: [
					"uniform float opacity;",
					"varying vec3 vColor;",
					//THREE.ShaderChunk["color_pars_fragment"],

					"void main() {",

					THREE.ShaderChunk["alphatest_fragment"],
					//THREE.ShaderChunk["color_fragment"],
					"gl_FragColor = vec4( vColor, opacity );",

					THREE.ShaderChunk["linear_to_gamma_fragment"],

					THREE.ShaderChunk["fog_fragment"],

					"}"

				].join("\n")
			}
		},
		drag: {
			_deltaAngle: 0,
			_deltaRadius: 0,
			snap: 0,
			handlespeed: 0.2, //How fast to snap to handles
			finishspeed: 0.1, //How fast to shrink to nothingness at end
			returnspeed: 0.05, //How fast to return to the cursor
			object: null,
			geometry: null,
			subdivisions: 64,
			material: new THREE.ShaderMaterial({
				blending: THREE.AdditiveBlending,
				//wireframe: true,
				uniforms: {
					"diffuse": {
						"type": "c",
						"value": new THREE.Color(0xFFFFFF)
					},
					"opacity": {
						"type": "f",
						"value": 1
					},
					"startAngle": {
						type: "f",
						value: 0
					},
					"deltaAngle": {
						type: "f",
						value: 0
					},
					"startRadius": {
						type: "f",
						value: 0
					},
					"deltaRadius": {
						type: "f",
						value: 0
					}
				},

				vertexShader: [
					"uniform float startAngle;",
					"uniform float deltaAngle;",
					"uniform float startRadius;",
					"uniform float deltaRadius;",

					"void main() {",

					"float radius=startRadius+deltaRadius*position.x;",
					"float theta=startAngle+deltaAngle*position.x;",
					"vec3 pos=vec3(radius * cos(theta), radius * sin(theta), position.z);",
					//Use some calculus! Numerical differentiation for the win!
					"vec3 deltaPos=5.0*normalize(vec3((radius-deltaRadius*0.001) * cos(theta-deltaAngle*0.001), (radius-deltaRadius*0.001) * sin(theta-deltaAngle*0.001), position.z)-pos);",
					//Then, throw in some rotation matrices
					"if(position.y>0.5){",
					"pos=vec3(pos.x+deltaPos.y,pos.y-deltaPos.x,pos.z);",
					"}",
					"else{",
					"pos=vec3(pos.x-deltaPos.y,pos.y+deltaPos.x,pos.z);",
					"}",
					"gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );",

					"}"

				].join("\n"),

				fragmentShader: [

					"uniform vec3 diffuse;",
					"uniform float opacity;",

					"void main() {",

					THREE.ShaderChunk["alphatest_fragment"],

					"gl_FragColor = vec4( diffuse,opacity);",

					THREE.ShaderChunk["linear_to_gamma_fragment"],

					THREE.ShaderChunk["fog_fragment"],

					"}"

				].join("\n")
			})
		}
	}
	//The object that is saved and restored, containing current level and previous level histories.
	this.savedata = {
		levelpack: 0,
		level: 0,
		levelpacks: []
	}
	//Sets things up the first time around.
	this.setup();
}
Plasmid.prototype = {
	//Shows the logo and menu items.
	show_main: function() {
		this.mainmenu.logo.object.visible = true;
		this.view.position.set(this.interaction.defaultViewDistance / 4, 0, this.interaction.defaultViewDistance);
		this.view.lookAt.set(this.interaction.defaultViewDistance / 4, 0, 0);
		//AUTO REDIRECT - TODO: REMOVE
		this.state = this.LEVEL;
		this.show_level();
	},
	//Shows the level UI
	show_level: function() {
		this.mainmenu.logo.object.visible = false;
		this.view.position.set(0, 0, this.interaction.defaultViewDistance);
		this.view.lookAt.set(0, 0, 0);
	},
	//Gets the nearest handle from a position, setting the results into the interaction object
	level_nearest: function() {
		this.interaction.nearest = null;
		this.interaction.selection.nearestDistance = Infinity;
		for (var i = 0; i < this.current.handles.length; i++) {
			var dist = this.current.handles[i].object.position.distanceTo(this.interaction.cursor.projected);
			if (dist < this.interaction.selection.nearestDistance) {
				this.interaction.selection.nearestDistance = dist;
				this.interaction.selection.nearest = this.current.handles[i];
			}
		}
	},
	//Makes a move to the current level
	level_move: function(handle1, handle2) {
		if (!handle2) {
			//Split
		} else if (handle1.ring == handle2.ring) {
			//Reverse
			var ring = this.current.save.locations[handle1.ring];
			//Make sure we take the shortcut, not the long-cut
			if (handle2.segment < handle1.segment && handle2.segment + 1 + ring.length - handle1.segment > handle1.segment - handle2.segment || handle2.segment > handle1.segment && handle1.segment + ring.length - handle2.segment < handle2.segment - handle1.segment) {
				var temp = handle2;
				handle2 = handle1;
				handle1 = temp;
			}
			if (handle2.segment < handle1.segment) {
				for (var i = 0; i < ring.length; i++) {
					if (i < handle2.segment || i >= handle1.segment) {
						ring[i].reversed = !ring[i].reversed;
					}
				}
			} else {
				for (var i = handle1.segment; i < handle2.segment; i++) {
					ring[i].reversed = !ring[i].reversed;
				}
			}
			this.utils_reverse(ring, handle1.segment, handle2.segment - 1);
		} else {
			//Join
		}
	},
	//Checks to see if the level is completed
	level_iscomplete: function() {
		for (var r = 0; r < this.current.save.locations.length; r++) {
			var ring = this.current.save.locations[r];
			for (var s = 0; s < ring.length; s++) {
				var first = ring[s],
					second = ring[(s + 1) % ring.length],
					firstTo = first.reversed ? this.current.level.segments[first.segment].from : this.current.level.segments[first.segment].to;
				secondFrom = second.reversed ? this.current.level.segments[second.segment].to : this.current.level.segments[second.segment].from;
				if (firstTo != secondFrom) {
					return false;
				}
			}
		}
		return true;
	},
	//Loads up a new level, handling the saving and restoration of level state.
	level_load: function() {
		//Find the level, if it exists.
		if (this.savedata.levelpack in this.levelpacks) {
			this.current.pack = this.levelpacks[this.savedata.levelpack];
			if (this.savedata.level in this.current.pack.levels) {
				this.current.level = this.current.pack.levels[this.savedata.level];
				//Load in or create new save data based on the level.
				if (!(this.savedata.levelpack in this.savedata.levelpacks)) {
					this.savedata.levelpacks[this.savedata.levelpack] = [];
				}
				var savePack = this.savedata.levelpacks[this.savedata.levelpack];
				if (!(this.savedata.level in savePack)) {
					//Wrap each pristine segment in modifiable segment objects
					var level = this.utils_clone(this.current.level.locations);
					for (var r = 0; r < level.length; r++) {
						var ring = level[r];
						for (var s = 0; s < ring.length; s++) {
							ring[s] = {
								segment: ring[s],
								reversed: false
							};
						}
					}
					//Create save data
					savePack[this.savedata.level] = {
						locations: level,
						generations: 0
					}
				}
				var saveLevel = savePack[this.savedata.level];
				this.current.save = saveLevel;
				this.level_build();
				return;
			}
		}
		console.log("Save is invalid!")
	},
	//Builds and sets up everything in preparation for the level
	level_build: function() {
		this.ambient.background.colorTop.copy(this.current.pack.ambient.background.colorTop);
		this.ambient.background.colorBottom.copy(this.current.pack.ambient.background.colorBottom);
		this.ambient.background.geometry.colorsNeedUpdate = true;

		//Get the current segments to match the number of segments required in the level
		while (this.current.segments.length < this.current.level.segments.length) {
			var segment = {
				object: null,
				geometry: null,
				_startAngle: 0,
				_deltaAngle: 0,
				_startRadius: 0,
				_deltaRadius: 0,
				snap: true
			};
			segment.geometry = new THREE.Geometry();

			var settings = this.level.ring.materialSettings;
			settings.uniforms = this.utils_clone(settings.uniforms);

			segment.object = new THREE.Mesh(segment.geometry, new THREE.ShaderMaterial(settings));
			this.current.segments.push(segment);
			this.level.object.add(segment.object);
		}
		while (this.current.segments.length > this.current.level.segments.length) {
			var segment = this.current.segments.pop();
			this.level.object.remove(segment.object);
		}
		//Make all the segments match the requirements for the level
		for (var s = 0; s < this.current.segments.length; s++) {
			var segment = this.current.segments[s];
			segment.snap = true;
			//Resize vertex array
			var needsUpdate = false;
			while (segment.geometry.vertices.length < this.level.ring.subdivisions * 2) {
				segment.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
				needsUpdate = true;
			}
			while (segment.geometry.vertices.length > this.level.ring.subdivisions * 2) {
				segment.geometry.vertices.pop();
				needsUpdate = true;
			}
			if (needsUpdate) {
				//Set the positions in a way for the vertex shader to use
				for (var i = 0; i < this.level.ring.subdivisions; i++) {
					segment.geometry.vertices[2 * i].set(i / (this.level.ring.subdivisions - 1), 1, 0);
					segment.geometry.vertices[2 * i + 1].set(i / (this.level.ring.subdivisions - 1), 0, 0);
				}
				//Resize face array
				while (segment.geometry.faces.length < this.level.ring.subdivisions * 2 - 2) {
					segment.geometry.faces.push(new THREE.Face3());
				}
				while (segment.geometry.faces.length > this.level.ring.subdivisions * 2 - 2) {
					segment.geometry.faces.pop();
				}
				//Set face array to vertices
				for (var f = 0; f < this.level.ring.subdivisions - 1; f++) {
					segment.geometry.faces[2 * f].a = 2 * f;
					segment.geometry.faces[2 * f].b = 2 * f + 1;
					segment.geometry.faces[2 * f].c = 2 * f + 2;
					segment.geometry.faces[2 * f + 1].a = 2 * f + 3;
					segment.geometry.faces[2 * f + 1].b = 2 * f + 2;
					segment.geometry.faces[2 * f + 1].c = 2 * f + 1;
				}
			}
			//Let the vertex shader handle the positioning of vertices and the colors
		}

		//Handle the drag geometry
		var needsUpdate = false;
		if (this.level.drag.geometry == null) {
			//Create the drag path
			this.level.drag.geometry = new THREE.Geometry();
			this.level.drag.object = new THREE.Mesh(this.level.drag.geometry, this.level.drag.material);
			this.level.drag.object.position.z = this.interaction.interactionDistance;
			this.level.object.add(this.level.drag.object);
		}
		while (this.level.drag.geometry.vertices.length < this.level.drag.subdivisions * 2) {
			this.level.drag.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
			needsUpdate = true;
		}
		while (this.level.drag.geometry.vertices.length > this.level.drag.subdivisions * 2) {
			this.level.drag.geometry.vertices.pop();
			needsUpdate = true;
		}
		if (needsUpdate) {
			//Set the positions in a way for the vertex shader to use
			for (var i = 0; i < this.level.drag.subdivisions; i++) {
				this.level.drag.geometry.vertices[2 * i].set(i / (this.level.drag.subdivisions - 1), 1, Math.random());
				this.level.drag.geometry.vertices[2 * i + 1].set(i / (this.level.drag.subdivisions - 1), 0, Math.random());
			}

			//Resize face array
			while (this.level.drag.geometry.faces.length < 2 * this.level.drag.subdivisions - 2) {
				this.level.drag.geometry.faces.push(new THREE.Face3());
			}
			while (this.level.drag.geometry.faces.length > 2 * this.level.drag.subdivisions - 2) {
				this.level.drag.geometry.faces.pop();
			}
			//Set face array to vertices
			for (var f = 0; f < this.level.drag.subdivisions - 1; f++) {
				this.level.drag.geometry.faces[2 * f].a = 2 * f;
				this.level.drag.geometry.faces[2 * f].b = 2 * f + 1;
				this.level.drag.geometry.faces[2 * f].c = 2 * f + 2;
				this.level.drag.geometry.faces[2 * f + 1].a = 2 * f + 3;
				this.level.drag.geometry.faces[2 * f + 1].b = 2 * f + 2;
				this.level.drag.geometry.faces[2 * f + 1].c = 2 * f + 1;
			}
		}
	},
	//Updates the ring and UI when a move has been made
	level_update: function() {
		//Hide all segments to show when needed (just in case)
		// for (var i = 0; i < this.current.segments.length; i++) {
		// 	var segment = this.current.segments[i];

		// }
		//Place all the segments and handles where needed
		var currentHandle = 0;
		for (var r = 0; r < this.current.save.locations.length; r++) {
			var ring = this.current.save.locations[r];
			for (var s = 0; s < ring.length; s++) {
				var segment = this.current.segments[ring[s].segment],
					startAngle = s * 2 * Math.PI / ring.length + r * this.level.ring.offset,
					deltaAngle = 2 * Math.PI / ring.length - this.level.ring.separation,
					radius = this.level.ring.minRadius + r * this.level.ring.concentric;


				if (true) { //For empty segments in the future
					var handle;
					if (currentHandle >= this.current.handles.length) {
						handle = {
							object: new THREE.Mesh(new THREE.PlaneGeometry(this.images.handleSize, this.images.handleSize), this.level.handle.material),
							ring: 0,
							segment: 0,
							theta: 0,
							radius: 0,
							normalizedRadius: 0,
							normalizedX: 0,
							normalizedY: 0
						}
						this.current.handles.push(handle);
						this.level.object.add(handle.object);
					} else {
						handle = this.current.handles[currentHandle];
					}
					handle.ring = r;
					handle.segment = s;
					handle.theta = startAngle;
					handle.normalizedRadius = (r + 1) / this.current.save.locations.length;
					handle.object.position.set(Math.cos(startAngle), Math.sin(startAngle), 0)
						.multiplyScalar(radius + this.level.ring.thickness * 0.4);
					handle.radius = handle.object.position.length();
					handle.object.position.z = this.interaction.interactionDistance;
					handle.object.rotation.z = startAngle;
					handle.normalizedX = 0;
					handle.normalizedY = 0;
					currentHandle++;
				}
				segment._startAngle = startAngle + this.level.ring.separation * 0.5;
				segment._deltaAngle = deltaAngle;
				segment._startRadius = radius;
				segment._deltaRadius = this.level.ring.thickness;
				if (ring[s].reversed) {
					segment._startAngle += segment._deltaAngle;
					segment._deltaAngle *= -1;
					// segment._startRadius += segment._deltaRadius;
					// segment._deltaRadius *= -1;
				}
				if (segment.snap) {
					segment.snap = false;
					segment.object.material.uniforms.startRadius.value = segment._startRadius;
					segment.object.material.uniforms.deltaRadius.value = segment._deltaRadius;
					segment.object.material.uniforms.startAngle.value = segment._startAngle;
					segment.object.material.uniforms.deltaAngle.value = segment._deltaAngle;
				}
				segment.object.material.uniforms.fromColor.value.copy(this.current.pack.ambient.palette[this.current.level.segments[ring[s].segment].from]);
				segment.object.material.uniforms.toColor.value.copy(this.current.pack.ambient.palette[this.current.level.segments[ring[s].segment].to]);
				//segment.geometry.verticesNeedUpdate = true;
			}
		}
		//Remove extra handles
		while (currentHandle < this.current.handles.length) {
			this.level.object.remove(this.current.handles.pop().object);
		}
	},
	//Mouse callbacks
	mouse_down: function(x, y) {
		this.interaction.cursor.position.set(x, y, 0);
		this.interaction.cursor.handleDown = true;
		this.interaction.cursor.handleMove = true;
		this.interaction.cursor.down = true;
		this.view._tilt.set(x, y, 0).divide(this.size).multiplyScalar(2).addScalar(-1);
		this.view._tilt.y = -this.view._tilt.y;
	},
	mouse_up: function() {
		this.interaction.cursor.handleUp = true;
		this.interaction.cursor.down = false;
	},
	mouse_move: function(x, y) {
		this.interaction.cursor.position.set(x, y, 0);
		this.interaction.cursor.handleMove = true;
		this.view._tilt.set(x, y, 0).divide(this.size).multiplyScalar(2).addScalar(-1);
		this.view._tilt.y = -this.view._tilt.y;
		this.view.returning = true;
	},
	mouse_show: function() {
		this.interaction.cursor.handleVisibility = true;
		this.interaction.cursor.visible = true;
		this.view.returning = true;
		this.view.snap = this.view.defaultspeed;
	},
	mouse_hide: function() {
		this.interaction.cursor.handleVisibility = true;
		this.interaction.cursor.visible = false;
		this.view._tilt.set(0, 0, 0);
		this.view.returning = false;
		this.view.snap = this.view.defaultspeed;
	},
	touch_start: function(x, y) {
		this.interaction.cursor.position.set(x, y, 0);
		this.interaction.cursor.handleDown = true;
		this.interaction.cursor.handleMove = true;
		this.interaction.cursor.down = true;
		this.interaction.cursor.visible = true;
	},
	touch_end: function() {
		this.interaction.cursor.handleUp = true;
		this.interaction.cursor.down = false;
		this.interaction.cursor.visible = false;
	},
	touch_move: function(x, y) {
		this.interaction.cursor.position.set(x, y, 0);
		this.interaction.cursor.handleMove = true;
	},
	tilt: function(x, y) {
		p.view._tilt.set(x, y, 0);
		this.view.returning = false;
		this.view.snap = this.view.tiltspeed;
	},
	//Sets up everything.
	setup: function() {
		//The first thing called. Sets up everything.
		// Sets up the scene, camera, and renderer.
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.renderer = new THREE.WebGLRenderer({
			antialias: true
		});
		this.camera = new THREE.Camera(this.view.fov, this.width / this.height, this.view.near, this.view.far);
		this.scene = new THREE.Scene();
		this.scene.add(this.camera);

		//Set up post-processing
		if (this.usePostProcess) {
			this.composer = new THREE.EffectComposer(this.renderer);
			this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
			var pass = new THREE.ShaderPass(this.shaders.vignette);
			//pass.renderToScreen = true;
			this.composer.addPass(pass);
			pass = new THREE.ShaderPass(this.shaders.chromaticAbberation);
			this.composer.addPass(pass);
			pass = new THREE.ShaderPass(this.shaders.fxaa);
			pass.material.uniforms.resolution.value = this.size;
			pass.renderToScreen = true;
			this.composer.addPass(pass);
		}
		this.resize();
		this.canvascontainer.appendChild(this.renderer.domElement)

		//Start the loader!
		this.loader_load();

		//Set up the ambient background (hidden)
		this.setup_ambient();

		//Set up the main menu (hidden)
		this.setup_mainMenu();

		//Set up the level mechanics (hidden)
		this.setup_level();
	},
	//Sets up everything the level needs: ring and UI included.
	setup_level: function() {
		//Add some stuff
		this.scene.add(this.level.object);
		//Get the handle texture bound
		this.level.handle.material.map = this.images.handle;
		//Save the updating for when everything finishes loading - the ring is in the balance.
	},
	//Sets up the logo as well as the menu.
	setup_mainMenu: function() {
		//Logo
		this.mainmenu.logo.material = new THREE.MeshBasicMaterial({
			map: this.images.logo,
			transparent: true
		})
		this.mainmenu.logo.geometry = new THREE.PlaneGeometry(this.images.logoSize, this.images.logoSize);
		this.mainmenu.logo.object = new THREE.Mesh(this.mainmenu.logo.geometry, this.mainmenu.logo.material);
		this.mainmenu.logo.object.position.set(0, 0, 100)
		this.mainmenu.logo.object.visible = false;
		this.scene.add(this.mainmenu.logo.object);
	},
	//Sets up the ambient stuff: rays, colors, particles.
	setup_ambient: function() {
		//Background rays
		this.images.rays.wrapT = this.images.rays.wrapS = THREE.RepeatWrapping;
		this.images.rays.repeat.set(3, 3);
		this.ambient.rays.material.map = this.images.rays;
		this.ambient.rays.geometry = new THREE.PlaneGeometry(7000, 7000);
		this.ambient.rays.object = new THREE.Mesh(this.ambient.rays.geometry, this.ambient.rays.material);
		this.ambient.rays.object.position.set(500, 0, -1000);
		this.ambient.rays.object.rotation.order = "YXZ";
		this.ambient.rays.object.rotation.set(-0.5, 0.2, 0);
		this.ambient.rays.object.visible = false;
		this.scene.add(this.ambient.rays.object);

		//Background
		this.ambient.background.geometry = new THREE.PlaneGeometry(12000, 12000);
		this.ambient.background.geometry.faces[0].vertexColors.push(this.ambient.background.colorTop);
		this.ambient.background.geometry.faces[0].vertexColors.push(this.ambient.background.colorBottom);
		this.ambient.background.geometry.faces[0].vertexColors.push(this.ambient.background.colorTop);
		this.ambient.background.geometry.faces[1].vertexColors.push(this.ambient.background.colorBottom);
		this.ambient.background.geometry.faces[1].vertexColors.push(this.ambient.background.colorBottom);
		this.ambient.background.geometry.faces[1].vertexColors.push(this.ambient.background.colorTop);

		this.ambient.background.object = new THREE.Mesh(this.ambient.background.geometry, this.ambient.background.material);
		this.ambient.background.object.position.set(0, 0, -3000);
		this.ambient.background.object.visible = false;
		this.scene.add(this.ambient.background.object);

		//Handle particles when the loader is complete.
	},
	//Computes and renders at (hopefully) 60 frames per second.
	loop: function() {
		//Calculate elapsed time
		this.currentTime = Date.now();
		if (this.lastLoop > 0) {
			this.deltaTime = Math.min(this.currentTime - this.lastLoop, 100) / 1000;
		}
		this.lastLoop = this.currentTime;

		//Handle the mouse
		if (this.interaction.cursor.handleMove) {
			//Project the mouse position (approximately)
			this.interaction.cursor.position.divide(this.size);
			this.interaction.cursor.projected.set(this.size.x * (this.interaction.cursor.position.x - 0.5) / this.size.y, 0.5 - this.interaction.cursor.position.y, 0)
				.multiplyScalar(2 * this.interaction.maxHeight);
			//Find the nearest handle if selecting
			if (this.interaction.selection.selecting) {
				this.level_nearest();
				if (this.interaction.selection.nearest == this.interaction.selection.fromHandle) {
					this.interaction.selection.toHandle = null;
				} else {
					this.interaction.selection.toHandle = this.interaction.selection.nearest;
				}
			}
			this.interaction.cursor.handleMove = false;
		}
		if (this.interaction.cursor.handleDown) {
			//Find the nearest handle
			this.level_nearest();
			//Select it if it is close enough
			if (this.interaction.selection.nearestDistance < this.interaction.selection.distance) {
				this.interaction.selection.selecting = true;
				this.interaction.selection.fromHandle = this.interaction.selection.nearest;
				this.interaction.selection.toHandle = null;
			}
			this.interaction.cursor.handleDown = false;
		}
		if (this.interaction.cursor.handleUp) {
			if (this.interaction.selection.selecting) {
				//Make a move!
				if (this.interaction.selection.toHandle != null && this.interaction.selection.toHandle != this.interaction.selection.fromHandle) {
					this.level_move(this.interaction.selection.fromHandle, this.interaction.selection.toHandle);
					this.level_update();
					//Make the drag selection slink into itself
					this.level.drag.object.material.uniforms.startAngle.value += this.level.drag._deltaAngle;
					this.level.drag.object.material.uniforms.startRadius.value += this.level.drag._deltaRadius;
					this.level.drag.object.material.uniforms.deltaAngle.value *= -1;


				} else if (false) { //TODO: Separate

				}
			}
			//Not selecting anymore
			this.interaction.selection.selecting = false;
			this.interaction.cursor.handleUp = false;
		}
		//Take care of the selection
		if (this.level.drag.object != null) {
			if (this.interaction.selection.selecting && this.interaction.selection.fromHandle) {
				this.level.drag.object.material.uniforms.startAngle.value = this.interaction.selection.fromHandle.theta;
				this.level.drag.object.material.uniforms.startRadius.value = this.interaction.selection.fromHandle.radius;
				if (this.interaction.selection.toHandle == null) {
					//Follow the mouse
					this.level.drag._deltaAngle = Math.atan2(this.interaction.cursor.projected.y, this.interaction.cursor.projected.x);
					this.level.drag._deltaRadius = this.interaction.cursor.projected.length();
					this.level.drag.snap = Math.min(1, this.level.drag.snap + this.level.drag.returnspeed);
				} else {
					//Snap to a handle
					this.level.drag._deltaAngle = this.interaction.selection.toHandle.theta;
					this.level.drag._deltaRadius = this.interaction.selection.toHandle.radius;
					this.level.drag.snap = this.level.drag.handlespeed;
				}
				this.level.drag._deltaAngle -= this.level.drag.object.material.uniforms.startAngle.value;
				this.level.drag._deltaRadius -= this.level.drag.object.material.uniforms.startRadius.value;
				//Take the shortest path
				while (this.level.drag._deltaAngle > Math.PI) {
					this.level.drag._deltaAngle = -2 * Math.PI + this.level.drag._deltaAngle;
				}
				while (this.level.drag._deltaAngle < -Math.PI) {
					this.level.drag._deltaAngle = 2 * Math.PI + this.level.drag._deltaAngle;
				}
			} else {
				//Return to nothingness
				// this.level.drag.object.material.uniforms.startAngle.value = 0;
				// this.level.drag.object.material.uniforms.startRadius.value = 0;
				this.level.drag._deltaAngle = 0;
				this.level.drag._deltaRadius = 0;
				this.level.drag.snap = this.level.drag.finishspeed;
			}
			this.level.drag.object.material.uniforms.deltaAngle.value = this.utils_lerp(this.level.drag.object.material.uniforms.deltaAngle.value, this.level.drag._deltaAngle, this.level.drag.snap);
			this.level.drag.object.material.uniforms.deltaRadius.value = this.utils_lerp(this.level.drag.object.material.uniforms.deltaRadius.value, this.level.drag._deltaRadius, this.level.drag.snap);
		}

		//Move the camera based on the mouse
		this.view._position.lerp(this.view.position, this.lerpspeed);
		this.camera.position.copy(this.view._position);
		if (this.view.returning) {
			this.view.snap = Math.min(1, this.view.snap + this.view.returnspeed);
		}
		this.view.tilt.lerp(this.view._tilt, this.view.snap);
		this.camera.position.x += this.view.tilt.x * this.view.maxTilt;
		this.camera.position.y += this.view.tilt.y * this.view.maxTilt;
		this.view._lookAt.lerp(this.view.lookAt, this.lerpspeed);
		this.camera.lookAt(this.view._lookAt);

		//Lerp the segments
		if (this.current.save != null) {
			for (var r = 0; r < this.current.save.locations.length; r++) {
				var ring = this.current.save.locations[r];
				for (var s = 0; s < ring.length; s++) {
					var segment = this.current.segments[ring[s].segment];
					segment.object.material.uniforms.startAngle.value = this.utils_lerpAngle(segment.object.material.uniforms.startAngle.value, segment._startAngle, this.level.ring.lerpspeed);
					segment.object.material.uniforms.deltaAngle.value = this.utils_lerp(segment.object.material.uniforms.deltaAngle.value, segment._deltaAngle, this.level.ring.lerpspeed);
					segment.object.material.uniforms.startRadius.value = this.utils_lerp(segment.object.material.uniforms.startRadius.value, segment._startRadius, this.level.ring.lerpspeed);
					segment.object.material.uniforms.deltaRadius.value = this.utils_lerp(segment.object.material.uniforms.deltaRadius.value, segment._deltaRadius, this.level.ring.lerpspeed);

				}
			}
		}
		//Rotate the ring
		if (this.state == this.LOADING) {

		} else {
			//Move the rays
			this.images.rays.offset.x -= this.ambient.rays.raySpeed * this.deltaTime;

			//Update the particles
			if (this.ambient.particles.object && this.useparticles) {
				this.ambient.particles.material.uniforms.time.value += this.deltaTime;
				//this.ambient.particles.material.uniforms.scale.value = this.width;
			}
		}
		//Render!
		if (this.usePostProcess) {
			this.composer.render(0.01);
		} else {
			this.renderer.render(this.scene, this.camera);
		}
	},
	//Resizes everything necessary.
	resize: function() {
		this.size.set(window.innerWidth, window.innerHeight, 0);
		this.renderer.setSize(this.size.x, this.size.y);
		this.camera.projectionMatrix.makePerspective(this.view.fov, this.size.x / this.size.y, this.view.near, this.view.far);
		this.interaction.maxHeight = (this.interaction.defaultViewDistance + this.interaction.adjustedProjectionDistance) * Math.atan(Math.PI * this.view.fov / 360);
		if (this.usePostProcess) {
			//this.composer.setSize(this.size.x, this.size.y);
			this.composer.reset();
		}
	},
	//Loads all the images
	loader_load: function() {
		var that = this;
		for (var image in this.images.source) {
			this.images[image] = THREE.ImageUtils.loadTexture("images/" + this.images.source[image], undefined, function() {
				that.loader_callback()
			});
			this.images[image].anisotropy = this.renderer.getMaxAnisotropy()
			this.images.count++;
		}
	},
	//Reports loader progress
	loader_callback: function() {
		this.images.loaded++;
		this.loading.progress = this.images.loaded / this.images.count;
		if (this.images.loaded >= this.images.count) {
			this.loader_complete();
			this.state = this.MAIN;
		}
	},
	//Shows the main menu, after loading has completed.
	loader_complete: function() {
		this.level_load();
		this.level_update();
		this.show_main();
		//Snap! Fast!
		this.view.position.copy(this.view._position);
		this.view.lookAt.copy(this.view._lookAt);
		//Show everything
		this.ambient.rays.object.visible = true;
		this.ambient.background.object.visible = true;
		//this.current.ring.object.visible = true;

		//Handle the particles
		if (this.useparticles && this.ambient.particles.object == null) {
			this.ambient.particles.geometry.attributes = {
				position: {
					itemSize: 3,
					array: new Float32Array(this.ambient.particles.numParticles * 3),
					numItems: this.ambient.particles.numParticles * 3
				},
				velocity: {
					itemSize: 1,
					array: new Float32Array(this.ambient.particles.numParticles),
					numItems: this.ambient.particles.numParticles
				}
			}
			this.ambient.particles.material.uniforms.boxSize.value.copy(this.ambient.particles.boxSize);
			var position = this.ambient.particles.geometry.attributes.position.array;
			for (var i = 0; i < this.ambient.particles.numParticles; i++) {
				position[3 * i] = Math.random() * this.ambient.particles.boxSize.x;
				position[3 * i + 1] = Math.random() * this.ambient.particles.boxSize.y;
				position[3 * i + 2] = Math.random() * this.ambient.particles.boxSize.z;
				this.ambient.particles.geometry.attributes.velocity.array[i] = Math.random() * this.ambient.particles.toMaxVelocity + this.ambient.particles.minVelocity;
			}
			this.ambient.particles.geometry.computeBoundingSphere();
			this.ambient.particles.material.uniforms.map.value = this.images.particle;
			this.ambient.particles.object = new THREE.ParticleSystem(
				this.ambient.particles.geometry,
				this.ambient.particles.material
			);
			this.scene.add(this.ambient.particles.object);
		}

	},
	//Creates a deep copy of object.
	utils_clone: function(object) {
		var clone = (object instanceof Array ? [] : object instanceof Object ? {} : false);
		if (clone !== false) {
			if ("clone" in object) {
				return object.clone();
			}
			for (var i in object) {
				clone[i] = arguments.callee(object[i]);
			}
			return clone;
		} else {
			return object;
		}
	},
	//Linearly interpolates a to b by factor n
	utils_lerp: function(a, b, n) {
		return a * (1 - n) + b * n;
	},
	//Linearly interpolates angle a (in radians) to angle b by factor n
	utils_lerpAngle: function(a, b, n) {
		if (a < b && b - a > Math.PI) {
			//Wrap to left
			return (this.utils_lerp(a, b - 2 * Math.PI, n) + 2 * Math.PI) % (2 * Math.PI);
		} else if (b < a && a - b > Math.PI) {
			//Wrap to right
			return this.utils_lerp(a, b + 2 * Math.PI, n) % (2 * Math.PI);
		} else {
			return this.utils_lerp(a, b, n);
		}
	},
	//Reverses array a from i to j.
	utils_reverse: function(a, i, j) {
		var halfway;
		if (j < i) {
			halfway = Math.floor((j + 1 + a.length - i) / 2);
		} else {
			halfway = Math.floor((j - i + 1) / 2);
		}
		for (var k = 0; k < halfway; k++) {
			var temp = a[(j - k + a.length) % a.length];
			a[(j - k + a.length) % a.length] = a[(i + k) % a.length];
			a[(i + k) % a.length] = temp;
		}
		return a;
	}
};
var p = new Plasmid(document.getElementById("canvascontainer"));
window.addEventListener("resize", function() {
	p.resize();
}, true);
p.canvascontainer.addEventListener("mousedown", function(event) {
	p.mouse_down(event.pageX, event.pageY);
}, true);
window.addEventListener("mouseup", function(event) {
	p.mouse_up();
}, true);
window.addEventListener("mousemove", function(event) {
	p.mouse_move(event.pageX, event.pageY);
}, true);
window.addEventListener("mouseout", function(event) {
	p.mouse_hide();
}, true);
p.canvascontainer.addEventListener("mouseover", function(event) {
	p.mouse_show();
}, true);
p.canvascontainer.addEventListener("touchstart", function(event) {
	p.canvascontainer.webkitRequestFullScreen();
	if ("touches" in event && event.touches.length > 0) {
		p.touch_start(event.touches[0].pageX, event.touches[0].pageY);
	}
	event.preventDefault();
}, true);
p.canvascontainer.addEventListener("touchmove", function(event) {
	if ("touches" in event && event.touches.length > 0) {
		p.touch_move(event.touches[0].pageX, event.touches[0].pageY);
	}
	event.preventDefault();
}, true);
p.canvascontainer.addEventListener("touchend", function(event) {
	if ("touches" in event && event.touches.length == 0) {
		p.touch_end();
	}
	event.preventDefault();
}, true);
window.addEventListener("deviceorientation", function(event) {
	p.tilt(
		Math.min(Math.max(-event.beta, -45), 45) / 45,
		Math.abs(event.gamma) / 45 - 1
	);
}, true);

var raf = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame;

function loop() {
	p.loop();
	if (raf) {
		raf(arguments.callee);
	} else {
		setTimeout(arguments.callee, 15);
	}
}
loop();