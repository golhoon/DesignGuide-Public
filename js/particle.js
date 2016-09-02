var wrapperEl = document.querySelector( '.particle' );
var controlsWrapperEl = document.querySelector( '.controls' );
var controlsToggleEl = document.querySelector( '.controls-toggle' );

// textarea
var inputEl = document.querySelector( '.textinput' );

// canvas for particles
var canvasEl = document.createElement( 'canvas' );
var ctx = canvasEl.getContext( '2d' );

// hidden canvas for calculating text pixels
var tmpCanvasEl = document.createElement( 'canvas' );
var tmpCtx = tmpCanvasEl.getContext( '2d' );

var dpr = window.devicePixelRatio || 1;

// window size
var size = { width: 300, height: 150 };

var two_pi = Math.PI * 2;

// all particles are stored in here
var particles = [ ];

// targets are all opaque pixels in the tmpCanvas
var targets = [ ];

var settings = {
	text: {
		fontSize: 320,
		lineHeight: 320,
		fontFamily: 'Lato, Lucida Grande',
		fontWeight: 'normal',
		paddingLeft: 40,
		paddingTop: 60
	},
	particles: {
		fillStyle: '#ffffff',
		targetToParticleRatio: 2 / 1,
		maxAge: 200,
		maxAddPerFrame: 60,
		agePerFrameMin: 0.1,
		agePerFrameMax: 2,
		maxDistanceToTarget: 20,
		maxSize: 2,
		maxVel: 2,
		friction: 0.004,
		maxAcc: 0.004,
		chaosAcc: 0.001
	},
	bg: {
		color1: '#ff5072',
		color2: '#ffa5c3',
		angle: 192
	}
};

function init () {
	setupCanvas();
	setupControls();
	settingsUpdated();
	draw();
}

function setupCanvas () {
	window.addEventListener( 'resize', updateCanvasSize );
	
	updateCanvasSize();

	wrapperEl.appendChild( canvasEl );
	canvasEl.classList.add( 'intro-canvas' );
	
	wrapperEl.appendChild( tmpCanvasEl );
	tmpCanvasEl.classList.add( 'tmp-canvas' );

	inputEl.addEventListener( 'input', updateTargets );
}

// update canvas sizes after the window size changed
function updateCanvasSize () {
	size.width = window.innerWidth,
	size.height = window.innerHeight;

	canvasEl.width = size.width * dpr;
	canvasEl.height = size.height * dpr;

	canvasEl.style.width = size.width + 'px';
	canvasEl.style.height = size.height + 'px';

	tmpCanvasEl.width = size.width;
	tmpCanvasEl.height = size.height;

	ctx.fillStyle = settings.particles.fillStyle;
}

// apply new settings to textarea and drawing canvas
function settingsUpdated () {
	for ( var key in settings.text ) {
		if ( typeof settings.text[key] === 'number' ) {
			inputEl.style[key] = settings.text[key] + 'px';
		} else {
			inputEl.style[key] = settings.text[key];
		}
	}

	ctx.fillStyle = settings.particles.fillStyle;
	
	updateTargets();
}

// if the text changed, we need to update the targets array
function updateTargets () {	
	var w = tmpCanvasEl.width;
	var h = tmpCanvasEl.height;

	tmpCtx.clearRect( 0, 0, w, h );
	
	drawMultilineTextToCanvas( tmpCtx, inputEl.value, settings.text );

	targets = [ ];

	var imageData = tmpCtx.getImageData( 0, 0, tmpCanvasEl.width, tmpCanvasEl.height );

	var x = 0;
	var y = 0;

	for ( var i = 0, len = imageData.data.length; i < len; i += 4 ) {
		var x = ( i / 4 ) % w;
		var y = Math.floor( ( i / 4 ) / w );

		// only pixels that are more that 50% opaque
		if ( imageData.data[i + 3] > ( 255 / 2 ) ) {
			targets.push( { x: x, y: y } );
		}
	}

	if ( targets.length ) {
		particles.forEach( function ( p ) {
			p.target = ~~( Math.random() * targets.length );
		} );
	}
}

// draw loop: this function calls itself all the time once started
function draw () {
	updateParticles();
	updatePositions();
	render();

	requestAnimationFrame( draw );
}

// delete and add particles if necessary
function updateParticles () {
	var p;
	var maxParticleCount = ~~( targets.length / settings.particles.targetToParticleRatio );

	if ( particles.length < maxParticleCount && targets.length ) {

		var particlesToAddCount = maxParticleCount - particles.length;

		if ( particlesToAddCount > settings.particles.maxAddPerFrame ) {
			particlesToAddCount = settings.particles.maxAddPerFrame;
		}

		for ( var i = 0; i < particlesToAddCount; i++ ) {
			p = getNewParticle( particles.length );

			particles.push( p );
		}
	}
	
	for ( var i = particles.length - 1; i >= 0; i-- ) {
		p = particles[i];

		if ( p && p.age > settings.particles.maxAge && p.size < 0.5 ) {
			particles.splice( i, 1 );
		}
	}
}

// move particles around, change their size
function updatePositions () {
	var p;
	var t;
	var d;
	var m;

	for ( var i = 0, len = particles.length; i < len; ++i ) {
		p = particles[i];
		t = targets[p.target];

		// grow older every frame
		p.age += p.agePerFrame;

		if ( t ) {

			// accelerate towards target, depending on the distance to the target
			d = getDistance( t, p.pos );
			m = mapRange( d, 0, 100, 0, settings.particles.maxAcc, true );
			
			p.acc.x += mapRange( t.x - p.pos.x, -100, 100, -m, m, true );
			p.acc.y += mapRange( t.y - p.pos.y, -100, 100, -m, m, true );

			// add some random acceleration
			p.acc.x += Math.cos( p.age ) * settings.particles.chaosAcc;
			p.acc.y += Math.sin( p.age ) * settings.particles.chaosAcc;

		} else {
			// if the target px was removed, get a new one
			if ( targets.length ) {
				p.target = ~~( Math.random() * targets.length );
			}
		}
		
		// change size depending on distance to target and age
		if ( p.age < settings.particles.maxAge ) {
			p.size = mapRange( d, 0, settings.particles.maxDistanceToTarget, settings.particles.maxSize, 0, true );
		} else {
			// shrink with age
			p.size *= 0.9;
		}

		if ( p.size < 0.5 ) {
			p.size = 0;
		}

		p.vel.x += p.acc.x;
		p.vel.y += p.acc.y;

		p.vel.x *= ( 1 - settings.particles.friction );
		p.vel.y *= ( 1 - settings.particles.friction );

		p.vel.x = clamp( p.vel.x, -settings.particles.maxVel, settings.particles.maxVel );
		p.vel.y = clamp( p.vel.y, -settings.particles.maxVel, settings.particles.maxVel );

		p.pos.x += p.vel.x;
		p.pos.y += p.vel.y;

		p.acc.x = 0;
		p.acc.y = 0;		
	}
}

// draw all visible particles to canvas
function render () {
	var scale = size.width / tmpCanvasEl.width;

	ctx.clearRect( 0, 0, size.width * dpr, size.height * dpr );
	
	ctx.beginPath();

	particles.forEach( function ( p ) {
		if ( p.size > 0 ) {
			ctx.moveTo( p.pos.x * dpr * scale, p.pos.y * dpr * scale );
			ctx.arc( p.pos.x * dpr * scale, p.pos.y * dpr * scale, p.size * dpr, 0, two_pi, true );
		}
	} );

	ctx.fill();
}

// HELPER FUNCTIONS

// y'all got some more of those ... particles?
function getNewParticle ( index ) {
	return {
		pos: {
			x: ~~( Math.random() * size.width ),
			y: ~~( Math.random() * size.height )
		},
		vel: {
			x: Math.cos( index ) * 0.01,
			y: Math.sin( index ) * 0.01
		},
		acc: {
			x: 0,
			y: 0
		},
		age: 0,
		agePerFrame: settings.particles.agePerFrameMin + ~~ ( Math.random() * ( settings.particles.agePerFrameMax - settings.particles.agePerFrameMin ) ),
		size: 0,
		target: ~~( Math.random() * targets.length )
	};
}

// canvas fillText can't really do multiline text,
// so we have to implement it ourselves... well, sort of...
function drawMultilineTextToCanvas ( ctx, text ) {
	var lines = text.split( '\n' );
	var x = settings.text.paddingLeft;
	var y = parseInt( settings.text.paddingTop, 10 ) + parseInt( settings.text.lineHeight, 10 );

	ctx.fillStyle = settings.particles.fillStyle;
	ctx.font = settings.text.fontWeight + ' ' + settings.text.fontSize + 'px ' + settings.text.fontFamily;

	lines.forEach( function ( line, lineIndex ) {
		ctx.fillText( line, x, y );
		y += parseInt( settings.text.lineHeight, 10 );
	} );
}

// distance between 2 points 
function getDistance ( p1, p2 ) {
	return Math.sqrt( Math.pow( p2.x - p1.x, 2 ) + Math.pow( p2.y - p1.y, 2 ) );
}

// maps one value to another... https://p5js.org/reference/#/p5/map
function mapRange ( value, inMin, inMax, outMin, outMax, clampResult ) {
	var result = ( ( value - inMin ) / ( inMax - inMin ) * ( outMax - outMin ) + outMin );

	if ( clampResult ) {
		if ( outMin > outMax ) {
			result = Math.min( Math.max( result, outMax ), outMin );
		} else {
			result = Math.min( Math.max( result, outMin ), outMax );
		}
	}
	
	return result;
}

function clamp ( value, min, max ) {
	return Math.min( Math.max( value, min ), max );
}

// CONTROLS UI
function setupControls () {
	addControlEl( settings.text, 'fontFamily', { label: 'font family', type: 'text', cb: settingsUpdated } );
	addControlEl( settings.text, 'fontSize', { label: 'font size', type: 'range', min: 0, max: 1000, step: 1, cb: settingsUpdated } );
	addControlEl( settings.text, 'fontWeight', { label: 'font weight', type: 'select', options: [ 'normal', 'bold' ], cb: settingsUpdated } );
	addControlEl( settings.text, 'lineHeight', { label: 'line height', type: 'range', min: 0, max: 1000, step: 1, cb: settingsUpdated } );
	addControlEl( settings.text, 'paddingLeft', { label: 'text x', type: 'range', min: 0, max: 1000, cb: settingsUpdated } );
	addControlEl( settings.text, 'paddingTop', { label: 'text y', type: 'range', min: 0, max: 1000, cb: settingsUpdated } );

	addControlEl( settings.particles, 'fillStyle', { label: 'particle color', type: 'color', cb: settingsUpdated } );
	addControlEl( settings.particles, 'targetToParticleRatio', { label: 'particle ratio', type: 'range', min: 1, max: 100 } );
	addControlEl( settings.particles, 'maxAge', { label: 'particle age', type: 'range', min: 1, max: 3000 } );
	addControlEl( settings.particles, 'maxAddPerFrame', { label: 'new particles per frame', type: 'range', min: 1, max: 100 } );
	addControlEl( settings.particles, 'maxDistanceToTarget', { label: 'max distance to letter', type: 'range', min: 1, max: 100 } );
	addControlEl( settings.particles, 'maxSize', { label: 'max particle size', type: 'range', min: 1, max: 100 } );
	addControlEl( settings.particles, 'maxVel', { label: 'max particle velocity', type: 'range', min: 0.1, max: 10, step: 0.001 } );
	addControlEl( settings.particles, 'friction', { label: 'particle friction', type: 'range', min: 0, max: 0.01, step: 0.001 } );
	addControlEl( settings.particles, 'maxAcc', { label: 'particle acceleration', type: 'range', min: 0, max: 0.1, step: 0.001 } );
	addControlEl( settings.particles, 'chaosAcc', { label: 'random acceleration', type: 'range', min: 0, max: 0.1, step: 0.001 } );

	addControlEl( settings.bg, 'color1', { label: 'bg color 1', type: 'color', cb: updateBG } );
	addControlEl( settings.bg, 'color2', { label: 'bg color 2', type: 'color', cb: updateBG } );
	addControlEl( settings.bg, 'angle', { label: 'bg angle', type: 'range', min: 0, max: 360, cb: updateBG } );

	controlsToggleEl.addEventListener( 'click', function () {
		document.body.classList.toggle( 'show-controls' );
	} );
}

function addControlEl ( settings, key, opts ) {
	var containerEl = document.createElement( 'div' );
	var valueEl;
	var labelEl;
	var controlEl = document.createElement( 'input' );
	var id = 'control-' + key.toLowerCase();

	var value = settings[key];

	containerEl.classList.add( 'control-container' );
	
	controlEl.type = opts.type
	controlEl.id = id;
	controlEl.value = value;
	controlEl.classList.add( 'control-input' );

	if ( opts.label ) {
		labelEl = document.createElement( 'label' );
		labelEl.classList.add( 'control-label' );
		labelEl.setAttribute( 'for', id );
		labelEl.textContent = opts.label;

		if ( opts.type === 'range' ) {
			valueEl = document.createElement( 'span' );
			valueEl.classList.add( 'control-value' );
			valueEl.textContent = value.toFixed( 3 );
			labelEl.appendChild( valueEl );
		}

		containerEl.appendChild( labelEl );
	}

	if ( typeof opts.min === 'number' ) { controlEl.min = opts.min; }
	if ( typeof opts.max === 'number' ) { controlEl.max = opts.max; }
	if ( typeof opts.step === 'number' ) { controlEl.step = opts.step; }

	controlEl.addEventListener( 'input', handler );

	if ( opts.type === 'color' ) {
		controlEl.addEventListener( 'change', handler );
	}

	function handler () {
		if ( [ 'color', 'text' ].indexOf( controlEl.type ) !== -1  ) {
			settings[key] = controlEl.value;
		}

		if ( controlEl.type === 'range' ) {
			settings[key] = parseFloat( controlEl.value );
			valueEl.textContent = settings[key].toFixed( 3 );
		}

		if ( typeof opts.cb === 'function' ) {
			opts.cb();
		}
	}	

	containerEl.appendChild( controlEl );
	controlsWrapperEl.appendChild( containerEl );
}

// update background gradient
function updateBG () {
	wrapperEl.style.background = 'linear-gradient(' + settings.bg.angle + 'deg, ' + settings.bg.color1 + ' 0%, ' + settings.bg.color2 + ' 100%)';
}

init();