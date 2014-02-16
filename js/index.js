var Plasmid = function(canvascontainer) {
	this.mouse = new THREE.Vector2();
	this.canvascontainer = canvascontainer;
	this.deltaTime = 0;
	this.lastLoop = 0;
	this.currentTime = 0;
	this.width = null;
	this.height = null;
	this.renderer = null;
	this.scene = null;
	this.camera = null;
	this.composer = null;
	this.usePostProcess = true;
	//Constants
	this.LOADING = 0
	this.MAIN = 1
	this.LEVELSELECT = 2
	this.LEVEL = 3
	this.ARCADE = 4
	//Helper objects
	this.loading = {
		loadedColor: new THREE.Color(0xFFFFFF),
		waitingColor: new THREE.Color(0x555555)
	}
	this.state = this.LOADING;
	this.mainmenu = {
		logo: {
			object: null,
			material: null
		}
	}
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
			numParticles: 512,
			velocities: null
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
	this.view = {
		fov: 45, //The field of view of the camera
		near: 0.1, //The near value of the camera
		far: 10000 //The far value of the camera
	}
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
	this.shaders = {
		vignette: {
			uniforms: {
				"tDiffuse": {
					type: "t",
					value: null
				},
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
				// "vec4 chromaticAbberation(sampler2D tDiffuse,vec2 vUv,float amount){",
				// 	"return vec4(",
				// 		"texture2D(tDiffuse,vUv).x,",
				// 		"texture2D(tDiffuse,vUv+vec2(amount,amount)).y,",
				// 		"texture2D(tDiffuse,vUv+vec2(-amount,-amount)).z,",
				// 		"1.0);",
				// "}",
				"void main() {",
				"float toCenter=length(vUv-vec2(0.5,0.5));",
				"gl_FragColor=texture2D(tDiffuse,vUv)*clamp(1.2-toCenter,0.0,1.0);",
				// "gl_FragColor=chromaticAbberation(tDiffuse,vUv,0.003)*clamp(1.2-toCenter,0.0,1.0);",
				"}"
			].join("\n")
		}
	}
	this.levelpacks = [{
		ambient: {
			//music:"",
			background: {
				colorTop: new THREE.Color(0x00DD00),
				colorBottom: new THREE.Color(0x002200)
			},
			colors: [
				new THREE.Color(0x00BB00),
				new THREE.Color(0x00BBBB),
				new THREE.Color(0x0088BB)
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
				to: 1
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
			colors: [
				new THREE.Color(0xBB9900),
				new THREE.Color(0xBB0000),
				new THREE.Color(0xEEEE00)
			]
		},
		levels: []
	}, {
		ambient: {
			//music:"",
			background: {
				colorTop: new THREE.Color(0xCC00CC),
				colorBottom: new THREE.Color(0xFFFF00)
			},
			colors: [
				new THREE.Color(0xCC00CC),
				new THREE.Color(0xFFDD00),
				new THREE.Color(0xDDDD00)
			]
		},
		levels: []
	}]
	this.current = {
		ring: {
			numSegments: 128, //The number of segments in the spinner
			geometry: new THREE.BufferGeometry(),
			object: null,
			material: new THREE.LineBasicMaterial({
				color: 0xFFFFFF,
				vertexColors: THREE.VertexColors
			}),
			rotationSpeed: -0.05, //How fast to rotate (radians/sec)
			innerRadius: 300, //The inner radius of the loading ring
			outerRadius: 350 //The outer radius of the loading ring
		},
		segments: null,
		generation: 0,
		pack: null,
		level: null,
		save: null
	}
	this.savedata = {
		levelpack: 0,
		level: 0,
		levelpacks: []
	}
	this.setup();
}
Plasmid.prototype = {
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
	//Builds and sets up everything in preperation for the level
	level_build: function() {
		this.ambient.background.colorTop.copy(this.current.pack.ambient.background.colorTop);
		this.ambient.background.colorBottom.copy(this.current.pack.ambient.background.colorBottom);
		this.ambient.background.geometry.colorsNeedUpdate = true;
		
	},
	//Updates the colors, ring, and UI to match the current state.
	level_update: function() {
		var currentPack = this.levelpacks[this.savedata.levelpack];
		//Colorful rings
		var tempColor = new THREE.Color(),
			color = this.current.ring.geometry.attributes.color.array;
		for (var i = 0; i < this.current.ring.numSegments; i++) {
			tempColor.setHSL(2 * i / this.current.ring.numSegments % 1, 1, 0.5);
			color[6 * i] = tempColor.r;
			color[6 * i + 1] = tempColor.g;
			color[6 * i + 2] = tempColor.b;
			color[6 * i + 3] = tempColor.r;
			color[6 * i + 4] = tempColor.g;
			color[6 * i + 5] = tempColor.b;
		}
		this.current.ring.geometry.attributes.color.needsUpdate = true;
	},
	//Sets up everything the level needs: ring and UI included.
	setup_level: function() {
		//Create all the objects
		this.current.ring.geometry.attributes = {
			position: {
				itemSize: 3,
				array: new Float32Array(this.current.ring.numSegments * 6),
				numItems: this.current.ring.numSegments * 6
			},
			color: {
				itemSize: 3,
				array: new Float32Array(this.current.ring.numSegments * 6),
				numItems: this.current.ring.numSegments * 6
			}
		}
		var position = this.current.ring.geometry.attributes.position.array,
			dx, dy, dtheta = Math.PI * 2 / this.current.ring.numSegments;
		for (var i = 0; i < this.current.ring.numSegments; i++) {
			dx = Math.sin(dtheta * i);
			dy = Math.cos(dtheta * i);
			position[6 * i] = dx * this.current.ring.innerRadius
			position[6 * i + 1] = dy * this.current.ring.innerRadius
			position[6 * i + 3] = dx * this.current.ring.outerRadius
			position[6 * i + 4] = dy * this.current.ring.outerRadius
		}
		this.current.ring.geometry.computeBoundingSphere();
		this.current.ring.object = new THREE.Line(
			this.current.ring.geometry,
			this.current.ring.material,
			THREE.LinePieces
		);
		this.scene.add(this.current.ring.object);

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
		this.ambient.particles.geometry.dynamic = true;
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
			this.ambient.particles.velocities[i] = Math.random() * 10 + 5;
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
	//Computes and renders at (hopefully) 60 frames per second.
	loop: function() {
		//Calculate elapsed time
		this.currentTime = (new Date()).valueOf();
		if (this.lastLoop > 0) {
			this.deltaTime = Math.min(this.currentTime - this.lastLoop, 100) / 1000;
		}
		this.lastLoop = this.currentTime;

		//Rotate the ring
		if (this.state == this.LOADING) {
			var colorToUse,
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
			this.current.ring.geometry.attributes.color.needsUpdate = true;
		} else {
			if (this.state = this.MAIN) {
				this.current.ring.object.rotation.z += this.current.ring.rotationSpeed * this.deltaTime;
			}
			//Move the rays
			this.images.rays.offset.x -= this.ambient.rays.raySpeed * this.deltaTime;

			//Update the particles
			if (this.ambient.particles.object) {
				var positions = this.ambient.particles.geometry.attributes.position.array;
				for (var i = 0; i < this.ambient.particles.numParticles; i++) {
					positions[3 * i + 1] += this.ambient.particles.velocities[i] * this.deltaTime;
					if (positions[3 * i + 1] > 500) {
						positions[3 * i + 1] = (positions[3 * i + 1] - 500) % 1000 - 500;
					}
				}
				this.ambient.particles.geometry.attributes.position.needsUpdate = true;
			}
		}
		//Move the camera
		this.camera.position.x = (this.mouse.x - 0.5) * 200;
		this.camera.position.y = -(this.mouse.y - 0.5) * 200;
		this.camera.lookAt(this.current.ring.object.position);

		//Render!
		if (this.usePostProcess) {
			this.composer.render();
		} else {
			this.renderer.render(this.scene, this.camera);
		}
	},
	resize: function() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.renderer.setSize(this.width, this.height);
		this.camera.projectionMatrix.makePerspective(this.view.fov, this.width / this.height, this.view.near, this.view.far);
		if (this.usePostProcess) {
			this.composer.setSize(this.width, this.height);
		}
	},
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
		this.ambient.rays.object.visible = true;
		this.mainmenu.logo.object.visible = true;
		this.ambient.background.object.visible = true;
		this.ambient.particles.object.visible = true;
		this.current.ring.object.visible = true;
	},
	//Creates a deep copy of object.
	utils_clone: function(object) {
		var clone = (object instanceof Array ? [] : object instanceof Object ? {} : false);
		if (clone !== false) {
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
	p.mouse.set(event.pageX / p.width, event.pageY / p.height)
})
document.body.addEventListener("touchstart", function(event) {
	document.body.webkitRequestFullScreen();
	if (event.touches && event.touches.length > 0) {
		p.mouse.set(event.touches[0].pageX, event.touches[0].pageY);
	}
})
document.body.addEventListener("touchmove", function(event) {
	if (event.touches && event.touches.length > 0) {
		p.mouse.set(event.touches[0].pageX, event.touches[0].pageY);
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