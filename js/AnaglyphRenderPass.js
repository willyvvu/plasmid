/**
 * @author mrdoob / http://mrdoob.com/
 * @author marklundin / http://mark-lundin.com/
 * @author alteredq / http://alteredqualia.com/
 * @author willy-vvu
 */

THREE.AnaglyphRenderPass = function(scene, camera, overrideMaterial, clearColor, clearAlpha) {
	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = (clearAlpha !== undefined) ? clearAlpha : 1;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.enabled = true;
	this.clear = true;
	this.needsSwap = false;

	this.eyeSep = 0;
	this.projectionMatrix = new THREE.Matrix4();
	this.focalLength = 1000; //Focal length
	this._aspect = 0;
	this._near = 0;
	this._far = 0;
	this._fov = 0;

	this._cameraL = new THREE.PerspectiveCamera();
	this._cameraL.matrixAutoUpdate = false;

	this._cameraR = new THREE.PerspectiveCamera();
	this._cameraR.matrixAutoUpdate = false;

	this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	this._scene = new THREE.Scene();
	this._scene.add(this._camera);

	this._params = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat
	};

	this._renderTargetL = null;
	this._renderTargetR = null;

	this._material = new THREE.ShaderMaterial({
		uniforms: {

			"mapLeft": {
				type: "t",
				value: this._renderTargetL
			},
			"mapRight": {
				type: "t",
				value: this._renderTargetR
			}

		},

		vertexShader: [

			"varying vec2 vUv;",

			"void main() {",

			"	vUv = uv;",
			"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

			"}"

		].join("\n"),

		fragmentShader: [

			"uniform sampler2D mapLeft;",
			"uniform sampler2D mapRight;",
			"varying vec2 vUv;",

			"void main() {",

			"	vec4 colorL, colorR;",

			"	colorL = texture2D( mapLeft, vUv );",
			"	colorR = texture2D( mapRight, vUv );",

			// http://3dtv.at/Knowhow/AnaglyphComparison_en.aspx
			"	gl_FragColor = vec4( colorL.g * 0.7 + colorL.b * 0.3, colorR.g, colorR.b, 1.0 ) * 1.1;",

			"}"

		].join("\n")

	});

	this._mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
	this._scene.add(this._mesh);
};
THREE.AnaglyphRenderPass.prototype = {
	setSize: function(width, height) {
		if (this._renderTargetL) this._renderTargetL.dispose();
		if (this._renderTargetR) this._renderTargetR.dispose();
		this.width = width;
		this.height = height;
		this._renderTargetL = new THREE.WebGLRenderTarget(this.width, this.height, this._params);
		this._renderTargetR = new THREE.WebGLRenderTarget(this.width, this.height, this._params);

		this._material.uniforms["mapLeft"].value = this._renderTargetL;
		this._material.uniforms["mapRight"].value = this._renderTargetR;

	},

	/*
	 * Renderer now uses an asymmetric perspective projection
	 * (http://paulbourke.net/miscellaneous/stereographics/stereorender/).
	 *
	 * Each camera is offset by the eye seperation and its projection matrix is
	 * also skewed asymetrically back to converge on the same projection plane.
	 * Added a focal length parameter to, this is where the parallax is equal to 0.
	 */

	render: function(renderer, writeBuffer, readBuffer, delta) {
		if (readBuffer.width != this.width || readBuffer.height != this.height) {
			this.setSize(readBuffer.width, readBuffer.height);
		}
		this.scene.updateMatrixWorld();

		if (this.camera.parent === undefined) this.camera.updateMatrixWorld();

		var hasCameraChanged = (this._aspect !== this.camera.aspect) || (this._near !== this.camera.near) || (this._far !== this.camera.far) || (this._fov !== this.camera.fov);

		if (hasCameraChanged) {
			this._aspect = this.camera.aspect;
			this._near = this.camera.near;
			this._far = this.camera.far;
			this._fov = this.camera.fov;

			this.projectionMatrix.copy(this.camera.projectionMatrix);
			this.eyeSep = this.focalLength / 30 * 0.5;
			var eyeSepOnProjection = this.eyeSep * this._near / this.focalLength;
			var ymax = this._near * Math.tan(THREE.Math.degToRad(this._fov * 0.5));
			var xmin, xmax;

			// translate xOffset



			// for left eye

			xmin = -ymax * this._aspect + eyeSepOnProjection;
			xmax = ymax * this._aspect + eyeSepOnProjection;

			this.projectionMatrix.elements[0] = 2 * this._near / (xmax - xmin);
			this.projectionMatrix.elements[8] = (xmax + xmin) / (xmax - xmin);

			this._cameraL.projectionMatrix.copy(this.projectionMatrix);

			// for right eye

			xmin = -ymax * this._aspect - eyeSepOnProjection;
			xmax = ymax * this._aspect - eyeSepOnProjection;

			this.projectionMatrix.elements[0] = 2 * this._near / (xmax - xmin);
			this.projectionMatrix.elements[8] = (xmax + xmin) / (xmax - xmin);

			this._cameraR.projectionMatrix.copy(this.projectionMatrix);

		}

		this._cameraL.matrixWorld.set(1, 0, 0, -this.eyeSep, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1).multiply(this.camera.matrixWorld);
		this._cameraL.near = this.camera.near;
		this._cameraL.far = this.camera.far;

		renderer.render(this.scene, this._cameraL, this._renderTargetL, true);

		this._cameraR.matrixWorld.set(1, 0, 0, this.eyeSep, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1).multiply(this.camera.matrixWorld);
		this._cameraR.near = this.camera.near;
		this._cameraR.far = this.camera.far;

		//renderer.render(this.scene, this._cameraR, this._renderTargetR, true);
		renderer.render(this.scene, this._cameraR, this._renderTargetR, true);


		//this.scene.overrideMaterial = this.overrideMaterial;

		if (this.clearColor) {

			this.oldClearColor.copy(renderer.getClearColor());
			this.oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor(this.clearColor, this.clearAlpha);

		}

		renderer.render(this._scene, this._camera, readBuffer, this.clear);

		if (this.clearColor) {

			renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);

		}

		//this.scene.overrideMaterial = null;

	},

	dispose: function() {
		if (this._renderTargetL) this._renderTargetL.dispose();
		if (this._renderTargetR) this._renderTargetR.dispose();
	}

};