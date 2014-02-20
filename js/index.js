var Plasmid = function(canvascontainer) {
	//Mouse position vector (TODO: Re-factor/Remove this)
	this.mouse = new THREE.Vector3();
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
	//Constants
	this.LOADING = 0;
	this.MAIN = 1;
	this.LEVELSELECT = 2;
	this.LEVEL = 3;
	this.ARCADE = 4;
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
			material: new THREE.ParticleSystemMaterial({
				size: 10,
				transparent: true,
				blending: THREE.AdditiveBlending,
				opacity: 0.3,
				depthWrite: false,
				sizeAttenuation: true
			}),
			geometry: new THREE.BufferGeometry(),
			numParticles: 256,
			velocities: null,
			toMaxVelocity: 15,
			minVelocity: 1
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
	//Defines the current camera field of view and look-at target
	this.view = {
		fov: 45, //The field of view of the camera
		near: 0.1, //The near value of the camera
		far: 10000, //The far value of the camera
		lookAt: new THREE.Vector3() //Where the camera should look
	}
	//Defines which image assets are needed, and stores them once loaded.
	this.images = {
		source: {
			particle: "Particle.png",
			logo: "Logo.png",
			rays: "Rays.png"
		},
		logoSize: {
			width: 450,
			height: 450
		},
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
					value: 0.001
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
				"gl_FragColor.y=texture2D(tDiffuse,vUv+vec2(amount,amount)).y;",
				"gl_FragColor.z=texture2D(tDiffuse,vUv+vec2(-amount,-amount)).z;",
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
				new THREE.Color(0x00BB00),
				new THREE.Color(0x002200),
				new THREE.Color(0x66BB77)
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
			}],
			locations: [
				[{
					segment: 0
				}, {
					segment: 1
				}, {
					segment: 2,
					reversed: true
				}]
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
			}],
			locations: [
				[{
					segment: 0
				}, {
					segment: 1
				}, {
					segment: 2,
					reversed: true
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
		save: null //A reference to the save data to the current level, containing location and history
	}
	//Contains assets and settings relevant the level ring and UI
	this.level = {
		ring: {
			subdivisions: 32, //How many sections to split each segment into
			separation: 0.05, //How many radians to keep between segments
			materialSettings: {
				color: 0xFFFFFF,
				//vertexColors: THREE.VertexColors,
				side: THREE.DoubleSide,
				transparent: true,
				blending: THREE.AdditiveBlending,
				uniforms: THREE.UniformsUtils.merge([

					THREE.UniformsLib["common"], {
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
					}

				]),

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

					"gl_Position = projectionMatrix * modelViewMatrix * vec4( radius * cos(theta), radius * sin(theta), 0.0, 1.0 );",
					//THREE.ShaderChunk["default_vertex"],

					"}"

				].join("\n"),

				fragmentShader: [

					"uniform vec3 diffuse;",
					"uniform float opacity;",
					"varying vec3 vColor;",
					//THREE.ShaderChunk["color_pars_fragment"],

					"void main() {",

					THREE.ShaderChunk["alphatest_fragment"],
					//THREE.ShaderChunk["color_fragment"],
					"gl_FragColor = vec4( vColor, 1.0 );",

					THREE.ShaderChunk["linear_to_gamma_fragment"],

					THREE.ShaderChunk["fog_fragment"],

					"}"

				].join("\n")
			},
			object: new THREE.Object3D(), //The object that holds all segments.
			minRadius: 300, //The minimum (inside) radius of the ring
			thickness: 50, //The thickness of the ring
			concentric: -70, //The gap between concentric rings
			offset: 0.2 //The offset (in radians) between concentric rings
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
	show_main: function(){
		this.mainmenu.logo.object.visible = true;
		// this.camera.position.set(300,0,1000);
		// this.view.lookAt.set(300,0,0);
	},
	//Shows the level UI
	show_level:function(){
		this.mainmenu.logo.object.visible = false;
		this.camera.position.set(0, 0, 1000);
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
					savePack[this.savedata.level] = {
						locations: this.utils_clone(this.current.level.locations),
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
				geometry: null
			};
			segment.geometry = new THREE.Geometry();

			var settings = this.level.ring.materialSettings;
			settings.uniforms = this.utils_clone(settings.uniforms);

			segment.object = new THREE.Mesh(segment.geometry, new THREE.ShaderMaterial(settings));
			this.current.segments.push(segment);
			this.level.ring.object.add(segment.object);
		}
		while (this.current.segments.length > this.current.level.segments.length) {
			var segment = this.current.segments.pop();
			this.level.ring.object.remove(segment.object);
		}
		//Make all the segments match the requirements for the level
		for (var s = 0; s < this.current.segments.length; s++) {
			var segment = this.current.segments[s];
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
			}
			//Resize face array
			while (segment.geometry.faces.length < this.level.ring.subdivisions * 2 - 2) {
				var face = new THREE.Face3();
				//face.vertexColors = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
				segment.geometry.faces.push(face);
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
			//Let the vertex shader handle the positioning of vertices and the colors
		}
	},
	//Updates the ring and UI when a move has been made
	level_update: function() {
		//Hide all segments to show when needed (just in case)
		for (var i = 0; i < this.current.segments.length; i++) {
			var segment = this.current.segments[i];

		}
		//Place all the segments where needed
		for (var r = 0; r < this.current.save.locations.length; r++) {
			var ring = this.current.save.locations[r];
			for (var s = 0; s < ring.length; s++) {
				var segment = this.current.segments[ring[s].segment],
					startAngle = s * 2 * Math.PI / ring.length,
					deltaAngle = 2 * Math.PI / ring.length - this.level.ring.separation;
				segment.object.material.uniforms.startAngle.value = startAngle + r * this.level.ring.offset;
				segment.object.material.uniforms.deltaAngle.value = deltaAngle;
				segment.object.material.uniforms.startRadius.value = this.level.ring.minRadius + r * this.level.ring.concentric;
				segment.object.material.uniforms.deltaRadius.value = this.level.ring.thickness;
				if (ring[s].reversed) {
					segment.object.material.uniforms.startAngle.value += segment.object.material.uniforms.deltaAngle.value;
					segment.object.material.uniforms.deltaAngle.value *= -1;
					segment.object.material.uniforms.startRadius.value += segment.object.material.uniforms.deltaRadius.value;
					segment.object.material.uniforms.deltaRadius.value *= -1;
				}
				segment.object.material.uniforms.fromColor.value.copy(this.current.pack.ambient.palette[this.current.level.segments[s].from]);
				segment.object.material.uniforms.toColor.value.copy(this.current.pack.ambient.palette[this.current.level.segments[s].to]);
				//segment.geometry.verticesNeedUpdate = true;
			}
		}
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
		this.camera.position.set(0, 0, 1000);
		this.scene = new THREE.Scene();
		this.scene.add(this.camera);

		//Set up post-processing
		if (this.usePostProcess) {
			this.composer = new THREE.EffectComposer(this.renderer);
			this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
			var pass = new THREE.ShaderPass(this.shaders.vignette);
			//pass.renderToScreen = true;
			this.composer.addPass(pass);
			// pass = new THREE.ShaderPass(this.shaders.chromaticAbberation);
			// this.composer.addPass(pass);
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
		this.scene.add(this.level.ring.object);
		//Save the updating for when everything finishes loading - the ring is in the balance.
	},
	//Sets up the logo as well as the menu.
	setup_mainMenu: function() {
		//Logo
		this.mainmenu.logo.material = new THREE.MeshBasicMaterial({
			map: this.images.logo,
			transparent: true
		})
		this.mainmenu.logo.geometry = new THREE.PlaneGeometry(this.images.logoSize.width, this.images.logoSize.height);
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

		//Particles
		//this.ambient.particles.geometry.dynamic = true;
		this.ambient.particles.geometry.attributes = {
			position: {
				itemSize: 3,
				array: new Float32Array(this.ambient.particles.numParticles * 3),
				numItems: this.ambient.particles.numParticles * 3
			}
		}
		this.ambient.particles.velocities = new Float32Array(this.ambient.particles.numParticles * 3);
		var position = this.ambient.particles.geometry.attributes.position.array;
		for (var i = 0; i < this.ambient.particles.numParticles; i++) {
			position[3 * i] = Math.random() * 1500 - 750;
			position[3 * i + 1] = Math.random() * 1000 - 500;
			position[3 * i + 2] = Math.random() * 1000 - 500;
			this.ambient.particles.velocities[i] = Math.random() * this.ambient.particles.toMaxVelocity + this.ambient.particles.minVelocity;
		}
		this.ambient.particles.geometry.computeBoundingSphere();
		this.ambient.particles.material.map = this.images.particle;
		this.ambient.particles.object = new THREE.ParticleSystem(
			this.ambient.particles.geometry,
			this.ambient.particles.material
		);
		this.ambient.particles.object.visible = false;
		this.scene.add(this.ambient.particles.object);
	},
	//Computes and renders at (hopefully) 60 frames per second.
	loop: function() {
		//Calculate elapsed time
		this.currentTime = Date.now();
		if (this.lastLoop > 0) {
			this.deltaTime = Math.min(this.currentTime - this.lastLoop, 100) / 1000;
		}
		this.lastLoop = this.currentTime;

		//Rotate the ring
		if (this.state == this.LOADING) {
			/*var colorToUse,
				color = this.current.ring.geometry.attributes.color.array;
			for (var i = 0; i < this.current.ring.numSegments; i++) {
				if (i / this.current.ring.numSegments < this.loading.progress) {
					colorToUse = this.loading.loadedColor;
				} else {
					colorToUse = this.loading.waitingColor;
				}
				color[6 * i] = colorToUse.r;
				color[6 * i + 1] = colorToUse.g;
				color[6 * i + 2] = colorToUse.b;
				color[6 * i + 3] = colorToUse.r;
				color[6 * i + 4] = colorToUse.g;
				color[6 * i + 5] = colorToUse.b;
			}
			this.current.ring.geometry.attributes.color.needsUpdate = true;*/
		} else {
			if (this.state = this.MAIN) {
				//this.current.ring.object.rotation.z += this.current.ring.rotationSpeed * this.deltaTime;
			}
			//Move the rays
			this.images.rays.offset.x -= this.ambient.rays.raySpeed * this.deltaTime;

			//Update the particles
			if (this.ambient.particles.object) {
				for (var i = 0; i < this.ambient.particles.numParticles; i++) {
					this.ambient.particles.geometry.attributes.position.array[3 * i + 1] += this.ambient.particles.velocities[i] * this.deltaTime;
					if (this.ambient.particles.geometry.attributes.position.array[3 * i + 1] > 500) {
						this.ambient.particles.geometry.attributes.position.array[3 * i + 1] = (this.ambient.particles.geometry.attributes.position.array[3 * i + 1] - 500) % 1000 - 500;
					}
				}
				this.ambient.particles.geometry.attributes.position.needsUpdate = true;
			}
		}
		//Move the camera
		this.camera.position.x = (this.mouse.x - 0.5) * 200;
		this.camera.position.y = -(this.mouse.y - 0.5) * 200;
		this.camera.lookAt(this.view.lookAt);

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
		this.ambient.rays.object.visible = true;
		this.ambient.background.object.visible = true;
		this.ambient.particles.object.visible = true;
		//this.current.ring.object.visible = true;
	},
	//Creates a deep copy of object.
	utils_clone: function(object) {
		var clone = (object instanceof Array ? [] : object instanceof Object ? {} : false);
		if (clone !== false) {
			if("clone" in object){
				return object.clone();
			}
			for (var i in object) {
				clone[i] = arguments.callee(object[i]);
			}
			return clone;
		} else {
			return object;
		}
	}
}
var p = new Plasmid(document.getElementById("canvascontainer"));
window.addEventListener("resize", function() {
	p.resize()
})
window.addEventListener("mousemove", function(event) {
	p.mouse.set(event.pageX, event.pageY).divide(p.size);
})
p.canvascontainer.addEventListener("touchstart", function(event) {
	p.canvascontainer.webkitRequestFullScreen();
	if (event.touches && event.touches.length > 0) {
		p.mouse.set(event.touches[0].pageX, event.touches[0].pageY).divide(p.size);
	}
	event.preventDefault();
})
p.canvascontainer.addEventListener("touchmove", function(event) {
	if (event.touches && event.touches.length > 0) {
		p.mouse.set(event.touches[0].pageX, event.touches[0].pageY).divide(p.size);
	}
	event.preventDefault();
})
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