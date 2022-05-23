/* https://darsa.in/fpsmeter/#!introduction */
;(function (w, undefined) {
	'use strict';

	/* Create a new element */
	function newEl(name) {
		return document.createElement(name);
	}

	/* Apply theme CSS properties to element. */
	function applyTheme(element, theme) {
		for (var name in theme) {
			try {
				element.style[name] = theme[name];
			} catch (e) {}
		}
		return element;
	}

	/* Return type of the value. */
	function type(value) {
		if (value == null) {
			return String(value);
		}

		if (typeof value === 'object' || typeof value === 'function') {
			return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)[1].toLowerCase() || 'object';
		}

		return typeof value;
	}

	/* Check whether the value is in an array. */
	function inArray(value, array) {
		if (type(array) !== 'array') {
			return -1;
		}
		if (array.indexOf) {
			return array.indexOf(value);
		}
		for (var i = 0, l = array.length; i < l; i++) {
			if (array[i] === value) {
				return i;
			}
		}
		return -1;
	}

	function extend() {
		var args = arguments;
		for (var key in args[1]) {
			if (args[1].hasOwnProperty(key)) {
				switch (type(args[1][key])) {
					case 'object':
						args[0][key] = extend({}, args[0][key], args[1][key]);
						break;

					case 'array':
						args[0][key] = args[1][key].slice(0);
						break;

					default:
						args[0][key] = args[1][key];
				}
			}
		}
		return args.length > 2 ?
			extend.apply(null, [args[0]].concat(Array.prototype.slice.call(args, 2))) :
			args[0];
	}

	/* Convert HSL color to HEX string. */
	function hslToHex(h, s, l) {
		var r, g, b;
		var v, min, sv, sextant, fract, vsf;

		if (l <= 0.5) {
			v = l * (1 + s);
		} else {
			v = l + s - l * s;
		}

		if (v === 0) {
			return '#000';
		} else {
			min = 2 * l - v;
			sv = (v - min) / v;
			h = 6 * h;
			sextant = Math.floor(h);
			fract = h - sextant;
			vsf = v * sv * fract;
			if (sextant === 0 || sextant === 6) {
				r = v;
				g = min + vsf;
				b = min;
			} else if (sextant === 1) {
				r = v - vsf;
				g = v;
				b = min;
			} else if (sextant === 2) {
				r = min;
				g = v;
				b = min + vsf;
			} else if (sextant === 3) {
				r = min;
				g = v - vsf;
				b = v;
			} else if (sextant === 4) {
				r = min + vsf;
				g = min;
				b = v;
			} else {
				r = v;
				g = min;
				b = v - vsf;
			}
			return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
		}
	}

	function componentToHex(c) {
		c = Math.round(c * 255).toString(16);
		return c.length === 1 ? '0' + c : c;
	}

	/* Manage element event listeners. */
	function listener(element, eventName, handler, remove) {
		if (element.addEventListener) {
			element[remove ? 'removeEventListener' : 'addEventListener'](eventName, handler, false);
		} else if (element.attachEvent) {
			element[remove ? 'detachEvent' : 'attachEvent']('on' + eventName, handler);
		}
	}

	// Preferred timing funtion
	var getTime;
	(function () {
		var perf = w.performance;
		if (perf && (perf.now || perf.webkitNow)) {
			var perfNow = perf.now ? 'now' : 'webkitNow';
			getTime = perf[perfNow].bind(perf);
		} else {
			getTime = function () {
				return +new Date();
			};
		}
	}());

	// WindowAnimationTiming interface polyfill
	var cAF = w.cancelAnimationFrame || w.cancelRequestAnimationFrame;
	var rAF = w.requestAnimationFrame;
	(function () {
		var vendors = ['moz', 'webkit', 'o'];
		var lastTime = 0;
		for (var i = 0, l = vendors.length; i < l && !cAF; ++i) {
			cAF = w[vendors[i]+'CancelAnimationFrame'] || w[vendors[i]+'CancelRequestAnimationFrame'];
			rAF = cAF && w[vendors[i]+'RequestAnimationFrame'];
		}
		if (!cAF) {
			rAF = function (callback) {
				var currTime = getTime();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				lastTime = currTime + timeToCall;
				return w.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
			};

			cAF = function (id) {
				clearTimeout(id);
			};
		}
	}());

	// Property name for assigning element text content
	var textProp = type(document.createElement('div').textContent) === 'string' ? 'textContent' : 'innerText';

	/* FPSMeter class. */
	function FPSMeter(anchor, options) {
		if (type(anchor) === 'object' && anchor.nodeType === undefined) {
			options = anchor;
			anchor = document.body;
		}
		if (!anchor) {
			anchor = document.body;
		}

		// Private properties
		var self = this;
		var o = extend({}, FPSMeter.defaults, options || {});

		var el = {};
		var cols = [];
		var theme, heatmaps;
		var heatDepth = 100;
		var heating = [];

		var thisFrameTime = 0;
		var frameTime = o.threshold;
		var frameStart = 0;
		var lastLoop = getTime() - frameTime;
		var time;

		var fpsHistory = [];
		var durationHistory = [];

		var frameID, renderID;
		var showFps = o.show === 'fps';
		var graphHeight, count, i, j;

		// Exposed properties
		self.options = o;
		self.fps = 0;
		self.duration = 0;
		self.isPaused = 0;

		self.tickStart = function () {
			frameStart = getTime();
		};

		self.tick = function () {
			time = getTime();
			thisFrameTime = time - lastLoop;
			frameTime += (thisFrameTime - frameTime) / o.smoothing;
			self.fps = 1000 / frameTime;
			self.duration = frameStart < lastLoop ? frameTime : time - frameStart;
			lastLoop = time;
		};

		self.pause = function () {
			if (frameID) {
				self.isPaused = 1;
				clearTimeout(frameID);
				cAF(frameID);
				cAF(renderID);
				frameID = renderID = 0;
			}
			return self;
		};

		/** Resume display rendering.*/
		self.resume = function () {
			if (!frameID) {
				self.isPaused = 0;
				requestRender();
			}
			return self;
		};

		self.set = function (name, value) {
			o[name] = value;
			showFps = o.show === 'fps';

			// Reposition elements when specific option has been updated
			if (inArray(name, rebuilders) !== -1) {
				createMeter();
			}
			if (inArray(name, repositioners) !== -1) {
				positionMeter();
			}
			return self;
		};

		self.showDuration = function () {
			self.set('show', 'ms');
			return self;
		};

		self.showFps = function () {
			self.set('show', 'fps');
			return self;
		};

		
		self.toggle = function () {
			self.set('show', showFps ? 'ms' : 'fps');
			return self;
		};

		self.hide = function () {
			self.pause();
			el.container.style.display = 'none';
			return self;
		};

		self.show = function () {
			self.resume();
			el.container.style.display = 'block';
			return self;
		};

		/* Check the current FPS and save it in history.*/
		function historyTick() {
			for (i = o.history; i--;) {
				fpsHistory[i] = i === 0 ? self.fps : fpsHistory[i-1];
				durationHistory[i] = i === 0 ? self.duration : durationHistory[i-1];
			}
		}

		/* Returns heat hex color based on values passed. */
		function getHeat(heatmap, value, min, max) {
			return heatmaps[0|heatmap][Math.round(Math.min((value - min) / (max - min) * heatDepth, heatDepth))];
		}

		/* Update counter number and legend. */
		function updateCounter() {
			if (el.legend.fps !== showFps) {
				el.legend.fps = showFps;
				el.legend[textProp] = showFps ? 'FPS' : 'ms';
			}
			count = showFps ? self.fps : self.duration;
			el.count[textProp] = count > 999 ? '999+' : count.toFixed(count > 99 ? 0 : o.decimals);
		}

		/* Render current FPS state. */
		function render() {
			time = getTime();
			if (lastLoop < time - o.threshold) {
				self.fps -= self.fps / Math.max(1, o.smoothing * 60 / o.interval);
				self.duration = 1000 / self.fps;
			}

			historyTick();
			updateCounter();

			if (o.heat) {
				if (heating.length) {
					for (i = heating.length; i--;) {
						heating[i].el.style[theme[heating[i].name].heatOn] = showFps ?
							getHeat(theme[heating[i].name].heatmap, self.fps, 0, o.maxFps) :
							getHeat(theme[heating[i].name].heatmap, self.duration, o.threshold, 0);
					}
				}

				if (el.graph && theme.column.heatOn) {
					for (i = cols.length; i--;) {
						cols[i].style[theme.column.heatOn] = showFps ?
							getHeat(theme.column.heatmap, fpsHistory[i], 0, o.maxFps) :
							getHeat(theme.column.heatmap, durationHistory[i], o.threshold, 0);
					}
				}
			}

			// Update graph columns height
			if (el.graph) {
				for (j = 0; j < o.history; j++) {
					cols[j].style.height = (showFps ?
						(fpsHistory[j] ? Math.round(graphHeight / o.maxFps * Math.min(fpsHistory[j], o.maxFps)) : 0) :
						(durationHistory[j] ? Math.round(graphHeight / o.threshold * Math.min(durationHistory[j], o.threshold)) : 0)
					) + 'px';
				}
			}
		}

		function requestRender() {
			if (o.interval < 20) {
				frameID = rAF(requestRender);
				render();
			} else {
				frameID = setTimeout(requestRender, o.interval);
				renderID = rAF(render);
			}
		}

		function eventHandler(event) {
			event = event || window.event;
			if (event.preventDefault) {
				event.preventDefault();
				event.stopPropagation();
			} else {
				event.returnValue = false;
				event.cancelBubble = true;
			}
			self.toggle();
		}

		/* Destroys the current FPSMeter instance. */
		self.destroy = function () {
			// Stop rendering
			self.pause();
			// Remove elements
			removeMeter();
			// Stop listening
			self.tick = self.tickStart = function () {};
		};

		/* Remove meter element. */
		function removeMeter() {
			if (o.toggleOn) {
				listener(el.container, o.toggleOn, eventHandler, 1);
			}
			anchor.removeChild(el.container);
		}

		/* Sets the theme.*/
		function setTheme() {
			theme = FPSMeter.theme[o.theme];

			heatmaps = theme.compiledHeatmaps || [];
			if (!heatmaps.length && theme.heatmaps.length) {
				for (j = 0; j < theme.heatmaps.length; j++) {
					heatmaps[j] = [];
					for (i = 0; i <= heatDepth; i++) {
						heatmaps[j][i] = hslToHex(0.33 / heatDepth * i, theme.heatmaps[j].saturation, theme.heatmaps[j].lightness);
					}
				}
				theme.compiledHeatmaps = heatmaps;
			}
		}

		function createMeter() {
			if (el.container) {
				removeMeter();
			}

			// Set theme
			setTheme();
			el.container = applyTheme(newEl('div'), theme.container);
			el.count = el.container.appendChild(applyTheme(newEl('div'), theme.count));
			el.legend = el.container.appendChild(applyTheme(newEl('div'), theme.legend));
			el.graph = o.graph ? el.container.appendChild(applyTheme(newEl('div'), theme.graph)) : 0;

			// Add elements to array
			heating.length = 0;
			for (var key in el) {
				if (el[key] && theme[key].heatOn) {
					heating.push({
						name: key,
						el: el[key]
					});
				}
			}

			// Graph
			cols.length = 0;
			if (el.graph) {
				// Create graph
				el.graph.style.width = (o.history * theme.column.width + (o.history - 1) * theme.column.spacing) + 'px';

				for (i = 0; i < o.history; i++) {
					cols[i] = el.graph.appendChild(applyTheme(newEl('div'), theme.column));
					cols[i].style.position = 'absolute';
					cols[i].style.bottom = 0;
					cols[i].style.right = (i * theme.column.width + i * theme.column.spacing) + 'px';
					cols[i].style.width = theme.column.width + 'px';
					cols[i].style.height = '0px';
				}
			}

			// Set the initial state
			positionMeter();
			updateCounter();

			// Append container to anchor
			anchor.appendChild(el.container);
			if (el.graph) {
				graphHeight = el.graph.clientHeight;
			}

			// Add event listeners
			if (o.toggleOn) {
				if (o.toggleOn === 'click') {
					el.container.style.cursor = 'pointer';
				}
				listener(el.container, o.toggleOn, eventHandler);
			}
		}

		/* Positions the meter based on options. */
		function positionMeter() {
			applyTheme(el.container, o);
		}

		(function () {
			// Create meter element
			createMeter();
			// Start rendering
			requestRender();
		}());
	}

	// Expose the extend function
	FPSMeter.extend = extend;

	// Expose the FPSMeter class
	window.FPSMeter = FPSMeter;

	// Default options
	FPSMeter.defaults = {
		interval:  100,     // Update interval in milliseconds.
		smoothing: 10,      // Spike smoothing strength. 1 means no smoothing.
		show:      'fps',   // Whether to show 'fps', or 'ms' = frame duration in milliseconds.
		toggleOn:  'click', // Toggle between show 'fps' and 'ms' on this event.
		decimals:  1,       // Number of decimals in FPS number. 1 = 59.9, 2 = 59.94, ...
		maxFps:    60,      // Max expected FPS value.
		threshold: 100,     // Minimal tick reporting interval in milliseconds.

		// Meter position
		position: 'absolute', 
		zIndex:   10,         
		left:     '5px',      
		top:      '5px',     
		right:    'auto',     
		bottom:   'auto',     
		margin:   '0 0 0 0',  

		// Theme
		theme: 'dark', // Meter theme. Build in: 'dark', 'light', 'transparent', 'colorful'.
		heat:  0,      // Allow themes to use coloring by FPS heat. 0 FPS = red, maxFps = green.

		// Graph
		graph:   0, // Whether to show history graph.
		history: 20 // How many history states to show in a graph.
	};

	// Option names that trigger FPSMeter rebuild or reposition when modified
	var rebuilders = [
		'toggleOn',
		'theme',
		'heat',
		'graph',
		'history'
	];
	var repositioners = [
		'position',
		'zIndex',
		'left',
		'top',
		'right',
		'bottom',
		'margin'
	];
}(window));

;(function (w, FPSMeter, undefined) {
	'use strict';

	// Themes object
	FPSMeter.theme = {};

	// Base theme with layout, no colors
	var base = FPSMeter.theme.base = {
		heatmaps: [],
		container: {
			heatOn: null,
			heatmap: null,
			padding: '5px',
			minWidth: '95px',
			height: '30px',
			lineHeight: '30px',
			textAlign: 'right',
			textShadow: 'none'
		},
		count: {
			heatOn: null,
			heatmap: null,
			position: 'absolute',
			top: 0,
			right: 0,
			padding: '5px 10px',
			height: '30px',
			fontSize: '24px',
			fontFamily: 'Consolas, Andale Mono, monospace',
			zIndex: 2
		},
		legend: {
			heatOn: null,
			heatmap: null,
			position: 'absolute',
			top: 0,
			left: 0,
			padding: '5px 10px',
			height: '30px',
			fontSize: '12px',
			lineHeight: '32px',
			fontFamily: 'sans-serif',
			textAlign: 'left',
			zIndex: 2			
		},
		graph: {
			heatOn: null,
			heatmap: null,
			position: 'relative',
			boxSizing: 'padding-box',
			MozBoxSizing: 'padding-box',
			height: '100%',
			zIndex: 1
		},
		column: {
			width: 4,
			spacing: 1,
			heatOn: null,
			heatmap: null
		}
	};

	// Dark theme
	FPSMeter.theme.dark = FPSMeter.extend({}, base, {
		heatmaps: [{
			saturation: 0.8,
			lightness: 0.8
		}],
		container: {
			background: '#222',
			color: '#fff',
			border: '1px solid #1a1a1a',
			textShadow: '1px 1px 0 #222'
		},
		count: {
			heatOn: 'color'
		},
		column: {
			background: '#3f3f3f'
		}
	});

	// Light theme
	FPSMeter.theme.light = FPSMeter.extend({}, base, {
		heatmaps: [{
			saturation: 0.5,
			lightness: 0.5
		}],
		container: {
			color: '#666',
			background: '#fff',
			textShadow: '1px 1px 0 rgba(255,255,255,.5), -1px -1px 0 rgba(255,255,255,.5)',
			boxShadow: '0 0 0 1px rgba(0,0,0,.1)'
		},
		count: {
			heatOn: 'color'
		},
		column: {
			background: '#eaeaea'
		}
	});

	// Colorful theme
	FPSMeter.theme.colorful = FPSMeter.extend({}, base, {
		heatmaps: [{
			saturation: 0.5,
			lightness: 0.6
		}],
		container: {
			heatOn: 'backgroundColor',
			background: '#888',
			color: '#fff',
			textShadow: '1px 1px 0 rgba(0,0,0,.2)',
			boxShadow: '0 0 0 1px rgba(0,0,0,.1)'
		},
		column: {
			background: '#777',
			backgroundColor: 'rgba(0,0,0,.2)'
		}
	});

	// Transparent theme
	FPSMeter.theme.transparent = FPSMeter.extend({}, base, {
		heatmaps: [{
			saturation: 0.8,
			lightness: 0.5
		}],
		container: {
			padding: 0,
			color: '#fff',
			textShadow: '1px 1px 0 rgba(0,0,0,.5)'
		},
		count: {
			padding: '0 5px',
			height: '40px',
			lineHeight: '40px'
		},
		legend: {
			padding: '0 5px',
			height: '40px',
			lineHeight: '42px'
		},
		graph: {
			height: '40px'
		},
		column: {
			width: 5,
			background: '#999',
			heatOn: 'backgroundColor',
			opacity: 0.5
		}
	});
}(window, FPSMeter));

(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true,
	rBackslash = /\\/g,
	rNonWord = /\W/;
[0, 0].sort(function() {
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function( selector, context, results, seed ) {
	results = results || [];
	context = context || document;

	var origContext = context;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}
	
	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var m, set, checkSet, extra, ret, cur, pop, i,
		prune = true,
		contextXML = Sizzle.isXML( context ),
		parts = [],
		soFar = selector;
	do {
		chunker.exec( "" );
		m = chunker.exec( soFar );

		if ( m ) {
			soFar = m[3];
		
			parts.push( m[1] );
		
			if ( m[2] ) {
				extra = m[3];
				break;
			}
		}
	} while ( m );

	if ( parts.length > 1 && origPOS.exec( selector ) ) {

		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );

		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] ) {
					selector += parts.shift();
				}
				
				set = posProcess( selector, set );
			}
		}

	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {

			ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ?
				Sizzle.filter( ret.expr, ret.set )[0] :
				ret.set[0];
		}

		if ( context ) {
			ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );

			set = ret.expr ?
				Sizzle.filter( ret.expr, ret.set ) :
				ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray( set );

			} else {
				prune = false;
			}

			while ( parts.length ) {
				cur = parts.pop();
				pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}

		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		Sizzle.error( cur || selector );
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );

		} else if ( context && context.nodeType === 1 ) {
			for ( i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && Sizzle.contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}

		} else {
			for ( i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}

	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function( results ) {
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort( sortOrder );

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[ i - 1 ] ) {
					results.splice( i--, 1 );
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function( expr, set ) {
	return Sizzle( expr, null, null, set );
};

Sizzle.matchesSelector = function( node, expr ) {
	return Sizzle( expr, null, null, [node] ).length > 0;
};

Sizzle.find = function( expr, context, isXML ) {
	var set;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var match,
			type = Expr.order[i];
		
		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice( 1, 1 );

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace( rBackslash, "" );
				set = Expr.find[ type ]( match, context, isXML );

				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = typeof context.getElementsByTagName !== "undefined" ?
			context.getElementsByTagName( "*" ) :
			[];
	}

	return { set: set, expr: expr };
};

Sizzle.filter = function( expr, set, inplace, not ) {
	var match, anyFound,
		old = expr,
		result = [],
		curLoop = set,
		isXMLFilter = set && set[0] && Sizzle.isXML( set[0] );

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.leftMatch[ type ].exec( expr )) != null && match[2] ) {
				var found, item,
					filter = Expr.filter[ type ],
					left = match[1];

				anyFound = false;

				match.splice(1,1);

				if ( left.substr( left.length - 1 ) === "\\" ) {
					continue;
				}

				if ( curLoop === result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;

					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;

								} else {
									curLoop[i] = false;
								}

							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		// Improper expression
		if ( expr === old ) {
			if ( anyFound == null ) {
				Sizzle.error( expr );

			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

Sizzle.error = function( msg ) {
	throw "Syntax error, unrecognized expression: " + msg;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],

	match: {
		ID: /#((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF\-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(?:(['"])(.*?)\3|(#?(?:[\w\u00c0-\uFFFF\-]|\\.)*)|)|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*\-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\(\s*(even|odd|(?:[+\-]?\d+|(?:[+\-]?\d*)?n\s*(?:[+\-]\s*\d+)?))\s*\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^\-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/
	},

	leftMatch: {},

	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},

	attrHandle: {
		href: function( elem ) {
			return elem.getAttribute( "href" );
		},
		type: function( elem ) {
			return elem.getAttribute( "type" );
		}
	},

	relative: {
		"+": function(checkSet, part){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !rNonWord.test( part ),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag ) {
				part = part.toLowerCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName.toLowerCase() === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},

		">": function( checkSet, part ) {
			var elem,
				isPartStr = typeof part === "string",
				i = 0,
				l = checkSet.length;

			if ( isPartStr && !rNonWord.test( part ) ) {
				part = part.toLowerCase();

				for ( ; i < l; i++ ) {
					elem = checkSet[i];

					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName.toLowerCase() === part ? parent : false;
					}
				}

			} else {
				for ( ; i < l; i++ ) {
					elem = checkSet[i];

					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},

		"": function(checkSet, part, isXML){
			var nodeCheck,
				doneName = done++,
				checkFn = dirCheck;

			if ( typeof part === "string" && !rNonWord.test( part ) ) {
				part = part.toLowerCase();
				nodeCheck = part;
				checkFn = dirNodeCheck;
			}

			checkFn( "parentNode", part, doneName, checkSet, nodeCheck, isXML );
		},

		"~": function( checkSet, part, isXML ) {
			var nodeCheck,
				doneName = done++,
				checkFn = dirCheck;

			if ( typeof part === "string" && !rNonWord.test( part ) ) {
				part = part.toLowerCase();
				nodeCheck = part;
				checkFn = dirNodeCheck;
			}

			checkFn( "previousSibling", part, doneName, checkSet, nodeCheck, isXML );
		}
	},

	find: {
		ID: function( match, context, isXML ) {
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m && m.parentNode ? [m] : [];
			}
		},

		NAME: function( match, context ) {
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [],
					results = context.getElementsByName( match[1] );

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},

		TAG: function( match, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( match[1] );
			}
		}
	},
	preFilter: {
		CLASS: function( match, curLoop, inplace, result, not, isXML ) {
			match = " " + match[1].replace( rBackslash, "" ) + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").replace(/[\t\n\r]/g, " ").indexOf(match) >= 0) ) {
						if ( !inplace ) {
							result.push( elem );
						}

					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}
			return false;
		},

		ID: function( match ) {
			return match[1].replace( rBackslash, "" );
		},

		TAG: function( match, curLoop ) {
			return match[1].replace( rBackslash, "" ).toLowerCase();
		},

		CHILD: function( match ) {
			if ( match[1] === "nth" ) {
				if ( !match[2] ) {
					Sizzle.error( match[0] );
				}

				match[2] = match[2].replace(/^\+|\s*/g, '');
				var test = /(-?)(\d*)(?:n([+\-]?\d*))?/.exec(
					match[2] === "even" && "2n" || match[2] === "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);
				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}
			else if ( match[2] ) {
				Sizzle.error( match[0] );
			}
			match[0] = done++;

			return match;
		},

		ATTR: function( match, curLoop, inplace, result, not, isXML ) {
			var name = match[1] = match[1].replace( rBackslash, "" );
			
			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}
			match[4] = ( match[4] || match[5] || "" ).replace( rBackslash, "" );

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},

		PSEUDO: function( match, curLoop, inplace, result, not ) {
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);

				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);

					if ( !inplace ) {
						result.push.apply( result, ret );
					}

					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}
			
			return match;
		},

		POS: function( match ) {
			match.unshift( true );

			return match;
		}
	},
	
	filters: {
		enabled: function( elem ) {
			return elem.disabled === false && elem.type !== "hidden";
		},

		disabled: function( elem ) {
			return elem.disabled === true;
		},

		checked: function( elem ) {
			return elem.checked === true;
		},
		
		selected: function( elem ) {
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}
			
			return elem.selected === true;
		},

		parent: function( elem ) {
			return !!elem.firstChild;
		},

		empty: function( elem ) {
			return !elem.firstChild;
		},

		has: function( elem, i, match ) {
			return !!Sizzle( match[3], elem ).length;
		},

		header: function( elem ) {
			return (/h\d/i).test( elem.nodeName );
		},

		text: function( elem ) {
			var attr = elem.getAttribute( "type" ), type = elem.type;
			return elem.nodeName.toLowerCase() === "input" && "text" === type && ( attr === type || attr === null );
		},

		radio: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "radio" === elem.type;
		},

		checkbox: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "checkbox" === elem.type;
		},

		file: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "file" === elem.type;
		},

		password: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "password" === elem.type;
		},

		submit: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return (name === "input" || name === "button") && "submit" === elem.type;
		},

		image: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "image" === elem.type;
		},

		reset: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return (name === "input" || name === "button") && "reset" === elem.type;
		},

		button: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && "button" === elem.type || name === "button";
		},

		input: function( elem ) {
			return (/input|select|textarea|button/i).test( elem.nodeName );
		},

		focus: function( elem ) {
			return elem === elem.ownerDocument.activeElement;
		}
	},
	setFilters: {
		first: function( elem, i ) {
			return i === 0;
		},

		last: function( elem, i, match, array ) {
			return i === array.length - 1;
		},

		even: function( elem, i ) {
			return i % 2 === 0;
		},

		odd: function( elem, i ) {
			return i % 2 === 1;
		},

		lt: function( elem, i, match ) {
			return i < match[3] - 0;
		},

		gt: function( elem, i, match ) {
			return i > match[3] - 0;
		},

		nth: function( elem, i, match ) {
			return match[3] - 0 === i;
		},

		eq: function( elem, i, match ) {
			return match[3] - 0 === i;
		}
	},
	filter: {
		PSEUDO: function( elem, match, i, array ) {
			var name = match[1],
				filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );

			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || Sizzle.getText([ elem ]) || "").indexOf(match[3]) >= 0;

			} else if ( name === "not" ) {
				var not = match[3];

				for ( var j = 0, l = not.length; j < l; j++ ) {
					if ( not[j] === elem ) {
						return false;
					}
				}

				return true;

			} else {
				Sizzle.error( name );
			}
		},

		CHILD: function( elem, match ) {
			var type = match[1],
				node = elem;

			switch ( type ) {
				case "only":
				case "first":
					while ( (node = node.previousSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}

					if ( type === "first" ) { 
						return true; 
					}

					node = elem;

				case "last":
					while ( (node = node.nextSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}

					return true;

				case "nth":
					var first = match[2],
						last = match[3];

					if ( first === 1 && last === 0 ) {
						return true;
					}
					
					var doneName = match[0],
						parent = elem.parentNode;
	
					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						} 
						parent.sizcache = doneName;
					}					
					var diff = elem.nodeIndex - last;

					if ( first === 0 ) {
						return diff === 0;

					} else {
						return ( diff % first === 0 && diff / first >= 0 );
					}
			}
		},

		ID: function( elem, match ) {
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},

		TAG: function( elem, match ) {
			return (match === "*" && elem.nodeType === 1) || elem.nodeName.toLowerCase() === match;
		},
		
		CLASS: function( elem, match ) {
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},

		ATTR: function( elem, match ) {
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value !== check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},

		POS: function( elem, match, i, array ) {
			var name = match[2],
				filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS,
	fescape = function(all, num){
		return "\\" + (num - 0 + 1);
	};

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + (/(?![^\[]*\])(?![^\(]*\))/.source) );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source.replace(/\\(\d+)/g, fescape) );
}

var makeArray = function( array, results ) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}
	
	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0)[0].nodeType;

} catch( e ) {
	makeArray = function( array, results ) {
		var i = 0,
			ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );

		} else {
			if ( typeof array.length === "number" ) {
				for ( var l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}

			} else {
				for ( ; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}
		return ret;
	};
}

var sortOrder, siblingCheck;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			return a.compareDocumentPosition ? -1 : 1;
		}

		return a.compareDocumentPosition(b) & 4 ? -1 : 1;
	};

} else {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		} else if ( a.sourceIndex && b.sourceIndex ) {
			return a.sourceIndex - b.sourceIndex;
		}

		var al, bl,
			ap = [],
			bp = [],
			aup = a.parentNode,
			bup = b.parentNode,
			cur = aup;

		if ( aup === bup ) {
			return siblingCheck( a, b );
		} else if ( !aup ) {
			return -1;

		} else if ( !bup ) {
			return 1;
		}

		while ( cur ) {
			ap.unshift( cur );
			cur = cur.parentNode;
		}

		cur = bup;

		while ( cur ) {
			bp.unshift( cur );
			cur = cur.parentNode;
		}

		al = ap.length;
		bl = bp.length;
		for ( var i = 0; i < al && i < bl; i++ ) {
			if ( ap[i] !== bp[i] ) {
				return siblingCheck( ap[i], bp[i] );
			}
		}
		return i === al ?
			siblingCheck( a, bp[i], -1 ) :
			siblingCheck( ap[i], b, 1 );
	};

	siblingCheck = function( a, b, ret ) {
		if ( a === b ) {
			return ret;
		}

		var cur = a.nextSibling;

		while ( cur ) {
			if ( cur === b ) {
				return -1;
			}

			cur = cur.nextSibling;
		}

		return 1;
	};
}

// Utility function for retreiving the text value of an array 
Sizzle.getText = function( elems ) {
	var ret = "", elem;

	for ( var i = 0; elems[i]; i++ ) {
		elem = elems[i];
		if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
			ret += elem.nodeValue;
		} else if ( elem.nodeType !== 8 ) {
			ret += Sizzle.getText( elem.childNodes );
		}
	}

	return ret;
};

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date()).getTime(),
		root = document.documentElement;

	form.innerHTML = "<a name='" + id + "'/>";
	root.insertBefore( form, root.firstChild );
	if ( document.getElementById( id ) ) {
		Expr.find.ID = function( match, context, isXML ) {
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);

				return m ?
					m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ?
						[m] :
						undefined :
					[];
			}
		};

		Expr.filter.ID = function( elem, match ) {
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");

			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	// release memory in IE
	root = form = null;
})();

(function(){
	var div = document.createElement("div");
	div.appendChild( document.createComment("") );
	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function( match, context ) {
			var results = context.getElementsByTagName( match[1] );
			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	// Check to see if an attribute returns normalized href attributes
	div.innerHTML = "<a href='#'></a>";

	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {

		Expr.attrHandle.href = function( elem ) {
			return elem.getAttribute( "href", 2 );
		};
	}
	div = null;
})();

if ( document.querySelectorAll ) {
	(function(){
		var oldSizzle = Sizzle,
			div = document.createElement("div"),
			id = "__sizzle__";

		div.innerHTML = "<p class='TEST'></p>";
		if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
			return;
		}
	
		Sizzle = function( query, context, extra, seed ) {
			context = context || document;
			if ( !seed && !Sizzle.isXML(context) ) {
				var match = /^(\w+$)|^\.([\w\-]+$)|^#([\w\-]+$)/.exec( query );
				
				if ( match && (context.nodeType === 1 || context.nodeType === 9) ) {
					if ( match[1] ) {
						return makeArray( context.getElementsByTagName( query ), extra );
					} else if ( match[2] && Expr.find.CLASS && context.getElementsByClassName ) {
						return makeArray( context.getElementsByClassName( match[2] ), extra );
					}
				}
				
				if ( context.nodeType === 9 ) {
					if ( query === "body" && context.body ) {
						return makeArray( [ context.body ], extra );
					} else if ( match && match[3] ) {
						var elem = context.getElementById( match[3] );
						if ( elem && elem.parentNode ) {
							if ( elem.id === match[3] ) {
								return makeArray( [ elem ], extra );
							}							
						} else {
							return makeArray( [], extra );
						}
					}
					
					try {
						return makeArray( context.querySelectorAll(query), extra );
					} catch(qsaError) {}
				} else if ( context.nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
					var oldContext = context,
						old = context.getAttribute( "id" ),
						nid = old || id,
						hasParent = context.parentNode,
						relativeHierarchySelector = /^\s*[+~]/.test( query );

					if ( !old ) {
						context.setAttribute( "id", nid );
					} else {
						nid = nid.replace( /'/g, "\\$&" );
					}
					if ( relativeHierarchySelector && hasParent ) {
						context = context.parentNode;
					}

					try {
						if ( !relativeHierarchySelector || hasParent ) {
							return makeArray( context.querySelectorAll( "[id='" + nid + "'] " + query ), extra );
						}

					} catch(pseudoError) {
					} finally {
						if ( !old ) {
							oldContext.removeAttribute( "id" );
						}
					}
				}
			}
		
			return oldSizzle(query, context, extra, seed);
		};

		for ( var prop in oldSizzle ) {
			Sizzle[ prop ] = oldSizzle[ prop ];
		}
		// release memory in IE
		div = null;
	})();
}

(function(){
	var html = document.documentElement,
		matches = html.matchesSelector || html.mozMatchesSelector || html.webkitMatchesSelector || html.msMatchesSelector;

	if ( matches ) {
		var disconnectedMatch = !matches.call( document.createElement( "div" ), "div" ),
			pseudoWorks = false;

		try {
			matches.call( document.documentElement, "[test!='']:sizzle" );
	
		} catch( pseudoError ) {
			pseudoWorks = true;
		}

		Sizzle.matchesSelector = function( node, expr ) {
			expr = expr.replace(/\=\s*([^'"\]]*)\s*\]/g, "='$1']");

			if ( !Sizzle.isXML( node ) ) {
				try { 
					if ( pseudoWorks || !Expr.match.PSEUDO.test( expr ) && !/!=/.test( expr ) ) {
						var ret = matches.call( node, expr );
						if ( ret || !disconnectedMatch || node.document && node.document.nodeType !== 11 ) {
							return ret;
						}
					}
				} catch(e) {}
			}
			return Sizzle(expr, null, null, [node]).length > 0;
		};
	}
})();

(function(){
	var div = document.createElement("div");

	div.innerHTML = "<div class='test e'></div><div class='test'></div>";
	if ( !div.getElementsByClassName || div.getElementsByClassName("e").length === 0 ) {
		return;
	}


	div.lastChild.className = "e";
	if ( div.getElementsByClassName("e").length === 1 ) {
		return;
	}	
	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function( match, context, isXML ) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};
	// release memory in IE
	div = null;
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];

		if ( elem ) {
			var match = false;
			elem = elem[dir];
			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}
				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}
				if ( elem.nodeName.toLowerCase() === cur ) {
					match = elem;
					break;
				}
				elem = elem[dir];
			}
			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];

		if ( elem ) {
			var match = false;			
			elem = elem[dir];
			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}
				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
				if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}
						} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}
				elem = elem[dir];
			}
			checkSet[i] = match;
		}
	}
}

if ( document.documentElement.contains ) {
	Sizzle.contains = function( a, b ) {
		return a !== b && (a.contains ? a.contains(b) : true);
	};
} else if ( document.documentElement.compareDocumentPosition ) {
	Sizzle.contains = function( a, b ) {
		return !!(a.compareDocumentPosition(b) & 16);
	};
} else {
	Sizzle.contains = function() {
		return false;
	};
}

Sizzle.isXML = function( elem ) {
	var documentElement = (elem ? elem.ownerDocument || elem : 0).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

var posProcess = function( selector, context ) {
	var match,
		tmpSet = [],
		later = "",
		root = context.nodeType ? [context] : context;
	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}
	selector = Expr.relative[selector] ? selector + "*" : selector;
	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}
	return Sizzle.filter( later, tmpSet );
};
// EXPOSE
window.Sizzle = Sizzle;
})();

AudioFX = function() {
  var hasAudio = false, audio = document.createElement('audio'), audioSupported = function(type) { var s = audio.canPlayType(type); return (s === 'probably') || (s === 'maybe'); };
  if (audio && audio.canPlayType) {
    hasAudio = {
      ogg: audioSupported('audio/ogg; codecs="vorbis"'),
      mp3: audioSupported('audio/mpeg;'),
      wav: audioSupported('audio/wav; codecs="1"'),
      loop: (typeof audio.loop === 'boolean')
    }
  }

  var isplaying = function(audio) { return !audio.paused && !audio.ended; }
  var create = function(src, options, onload) {
  var audio = document.createElement('audio');
    if (onload) {
      var ready = function() {
        audio.removeEventListener('canplay', ready, false);
        onload();
      }
      audio.addEventListener('canplay', ready, false);
    }
    if (options.loop && !hasAudio.loop)
    audio.addEventListener('ended', function() { audio.currentTime = 0; audio.play(); }, false);
    audio.volume = options.volume || 0.2;
    audio.loop   = options.loop;
    audio.src    = src;
    return audio;
  }

  var wrapper = function(src, options, onload) {
    var pool = [];
    if (hasAudio) {
      for(var n = 0 ; n < (options.pool || 1) ; n++)
        pool.push(create(src, options, n == 0 ? onload : null));
    }
    else {
      onload();
    }

    var find = function() {
      var n, audio;
      for(n = 0 ; n < pool.length ; n++) {
        audio = pool[n];
        if (audio.paused || audio.ended)
          return audio;
      }
    };

    return {
      audio: (pool.length == 1 ? pool[0] : pool),
      play: function() {
        var audio = find();
        if (audio && !AudioFX.mute)
          audio.play();
        return audio;
      },

      stop: function() {
        var n, audio;
        for(n = 0 ; n < pool.length ; n++) {
          audio = pool[n];
          if (isplaying(audio)) {
            audio.pause();
            audio.currentTime = 0;
          }
        }
      },

      fade: function(over) {
        var audio = this.audio,
            max   = audio.volume,
            dt    = 100,
            step  = function() {
              audio.volume = Math.max(0, audio.volume - (max/((over||1000)/dt)));
              if (audio.volume === 0) {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = max;
                return;
              }
              setTimeout(step, dt);
            };
        step();
      }
    };

  };

  var factory = function(name, options, onload) {
    options = options || {};
    var src = name, formats = options.formats;
    if (formats) {
      for(var n = 0 ; n < formats.length ; n++) {
        if (hasAudio && hasAudio[formats[n]]) {
          src = src + '.' + formats[n];
          break;  
        }
      }
    }
    return wrapper(src, options, onload);
  };

  factory.enabled = hasAudio; 
  factory.mute    = false;    
  return factory; 
}();

(function (window) {
  var StateMachine = {
    VERSION: "2.2.0",
    Result: {
      SUCCEEDED:    1, // the event transitioned successfully from one state to another
      NOTRANSITION: 2, // the event was successfull but no state transition was necessary
      CANCELLED:    3, // the event was cancelled by the caller in a beforeEvent callback
      PENDING:      4  // the event is asynchronous and the caller is in control of when the transition occurs
    },

    Error: {
      INVALID_TRANSITION: 100, 
      PENDING_TRANSITION: 200, 
      INVALID_CALLBACK:   300 
    },

    WILDCARD: '*',
    ASYNC: 'async',
    create: function(cfg, target) {
      var initial   = (typeof cfg.initial == 'string') ? { state: cfg.initial } : cfg.initial; 
      var terminal  = cfg.terminal || cfg['final'];
      var fsm       = target || cfg.target  || {};
      var events    = cfg.events || [];
      var callbacks = cfg.callbacks || {};
      var map       = {};
      var add = function(e) {
        var from = (e.from instanceof Array) ? e.from : (e.from ? [e.from] : [StateMachine.WILDCARD]); 
        map[e.name] = map[e.name] || {};
        for (var n = 0 ; n < from.length ; n++)
          map[e.name][from[n]] = e.to || from[n]; 
      };
      if (initial) {
        initial.event = initial.event || 'startup';
        add({ name: initial.event, from: 'none', to: initial.state });
      }
      for(var n = 0 ; n < events.length ; n++)
        add(events[n]);
      for(var name in map) {
        if (map.hasOwnProperty(name))
          fsm[name] = StateMachine.buildEvent(name, map[name]);
      }
      for(var name in callbacks) {
        if (callbacks.hasOwnProperty(name))
          fsm[name] = callbacks[name]
      }
      fsm.current = 'none';
      fsm.is      = function(state) { return (state instanceof Array) ? (state.indexOf(this.current) >= 0) : (this.current === state); };
      fsm.can     = function(event) { return !this.transition && (map[event].hasOwnProperty(this.current) || map[event].hasOwnProperty(StateMachine.WILDCARD)); }
      fsm.cannot  = function(event) { return !this.can(event); };
      fsm.error   = cfg.error || function(name, from, to, args, error, msg, e) { throw e || msg; };
      fsm.isFinished = function() { return this.is(terminal); };
      if (initial && !initial.defer)
      fsm[initial.event]();
      return fsm;

    },

    doCallback: function(fsm, func, name, from, to, args) {
      if (func) {
        try {
          return func.apply(fsm, [name, from, to].concat(args));
        }
        catch(e) {
          return fsm.error(name, from, to, args, StateMachine.Error.INVALID_CALLBACK, "an exception occurred in a caller-provided callback function", e);
        }
      }
    },

    beforeAnyEvent:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onbeforeevent'],                       name, from, to, args); },
    afterAnyEvent:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onafterevent'] || fsm['onevent'],      name, from, to, args); },
    leaveAnyState:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onleavestate'],                        name, from, to, args); },
    enterAnyState:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onenterstate'] || fsm['onstate'],      name, from, to, args); },
    changeState:     function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onchangestate'], name, from, to, args); },

    beforeThisEvent: function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onbefore' + name],                     name, from, to, args); },
    afterThisEvent:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onafter'  + name] || fsm['on' + name], name, from, to, args); },
    leaveThisState:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onleave'  + from],                     name, from, to, args); },
    enterThisState:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onenter'  + to]   || fsm['on' + to],   name, from, to, args); },

    beforeEvent: function(fsm, name, from, to, args) {
      if ((false === StateMachine.beforeThisEvent(fsm, name, from, to, args)) ||
          (false === StateMachine.beforeAnyEvent( fsm, name, from, to, args)))
        return false;
    },
    afterEvent: function(fsm, name, from, to, args) {
      StateMachine.afterThisEvent(fsm, name, from, to, args);
      StateMachine.afterAnyEvent( fsm, name, from, to, args);
    },
    leaveState: function(fsm, name, from, to, args) {
      var specific = StateMachine.leaveThisState(fsm, name, from, to, args),
          general  = StateMachine.leaveAnyState( fsm, name, from, to, args);
      if ((false === specific) || (false === general))
        return false;
      else if ((StateMachine.ASYNC === specific) || (StateMachine.ASYNC === general))
        return StateMachine.ASYNC;
    },
    enterState: function(fsm, name, from, to, args) {
      StateMachine.enterThisState(fsm, name, from, to, args);
      StateMachine.enterAnyState( fsm, name, from, to, args);
    },

    buildEvent: function(name, map) {
      return function() {
        var from  = this.current;
        var to    = map[from] || map[StateMachine.WILDCARD] || from;
        var args  = Array.prototype.slice.call(arguments); 
        if (this.transition)
          return this.error(name, from, to, args, StateMachine.Error.PENDING_TRANSITION, "event " + name + " inappropriate because previous transition did not complete");
        if (this.cannot(name))
          return this.error(name, from, to, args, StateMachine.Error.INVALID_TRANSITION, "event " + name + " inappropriate in current state " + this.current);
        if (false === StateMachine.beforeEvent(this, name, from, to, args))
          return StateMachine.Result.CANCELLED;
        if (from === to) {
          StateMachine.afterEvent(this, name, from, to, args);
          return StateMachine.Result.NOTRANSITION;
        }
        var fsm = this;
        this.transition = function() {
          fsm.transition = null;
          fsm.current = to;
          StateMachine.enterState( fsm, name, from, to, args);
          StateMachine.changeState(fsm, name, from, to, args);
          StateMachine.afterEvent( fsm, name, from, to, args);
          return StateMachine.Result.SUCCEEDED;
        };
        this.transition.cancel = function() { 
          fsm.transition = null;
          StateMachine.afterEvent(fsm, name, from, to, args);
        }
        var leave = StateMachine.leaveState(this, name, from, to, args);
        if (false === leave) {
          this.transition = null;
          return StateMachine.Result.CANCELLED;
        }
        else if (StateMachine.ASYNC === leave) {
          return StateMachine.Result.PENDING;
        }
        else {
          if (this.transition) // need to check in case user manually called transition() but forgot to return StateMachine.ASYNC
            return this.transition();
        }
      };
    }

  };
  
  if ("function" === typeof define) {
    define(function(require) { return StateMachine; });
  }
  else {
    window.StateMachine = StateMachine;
  }

}(this));

﻿/*	Animator.js 1.1.11*/
// Applies a sequence of numbers between 0 and 1 to a number of subject.
function Animator(options) {
	this.setOptions(options);
	var _this = this;
	this.timerDelegate = function(){_this.onTimerEvent()};
	this.subjects = [];
	this.target = 0;
	this.state = 0;
	this.lastTime = null;
};
Animator.prototype = {
	setOptions: function(options) {
		this.options = Animator.applyDefaults({
      repeat: false,
			interval: 20,  // time between animation frames
			duration: 400, // length of animation
			onComplete: function(){},
			onStep: function(){},
			transition: Animator.tx.easeInOut
		}, options);
	},
	// animate from the current state to provided value
	seekTo: function(to) {
		this.seekFromTo(this.state, to);
	},
	// animate from the current state to provided value
	seekFromTo: function(from, to) {
		this.target = Math.max(0, Math.min(1, to));
		this.state = Math.max(0, Math.min(1, from));
		this.lastTime = new Date().getTime();
		if (!this.intervalId) {
			this.intervalId = window.setInterval(this.timerDelegate, this.options.interval);
		}
	},
	// animate from the current state to provided value
	jumpTo: function(to) {
		this.target = this.state = Math.max(0, Math.min(1, to));
		this.propagate();
	},
	// seek to the opposite of the current target
	toggle: function() {
		this.seekTo(1 - this.target);
	},
	addSubject: function(subject) {
		this.subjects[this.subjects.length] = subject;
		return this;
	},
	// remove all subjects
	clearSubjects: function() {
		this.subjects = [];
	},
	// forward the current state to the animation subjects
	propagate: function() {
		var value = this.options.transition(this.state);
		for (var i=0; i<this.subjects.length; i++) {
			if (this.subjects[i].setState) {
				this.subjects[i].setState(value);
			} else {
				this.subjects[i](value);
			}
		}
	},
	// called once per frame to update the current state
	onTimerEvent: function() {
		var now = new Date().getTime();
		var timePassed = now - this.lastTime;
		this.lastTime = now;
		var movement = (timePassed / this.options.duration) * (this.state < this.target ? 1 : -1);
		if (Math.abs(movement) >= Math.abs(this.state - this.target)) {
			this.state = this.target;
		} else {
			this.state += movement;
		}
		
		try {
			this.propagate();
		} finally {
			this.options.onStep.call(this);
			if (this.target == this.state) {
        if (this.options.repeat === 'toggle')
          this.toggle();
        else if (this.options.repeat)
          this.play();
        else
  				this.stop();
			}
		}
	},
	stop: function() {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
			this.options.onComplete.call(this);
		}
	},
	play: function() {this.seekFromTo(0, 1)},
	reverse: function() {this.seekFromTo(1, 0)},
	inspect: function() {
		var str = "#<Animator:\n";
		for (var i=0; i<this.subjects.length; i++) {
			str += this.subjects[i].inspect();
		}
		str += ">";
		return str;
	}
}
Animator.applyDefaults = function(defaults, prefs) {
	prefs = prefs || {};
	var prop, result = {};
	for (prop in defaults) result[prop] = prefs[prop] !== undefined ? prefs[prop] : defaults[prop];
	return result;
}
// make an array from any object
Animator.makeArrayOfElements = function(o) {
	if (o == null) return [];
	if ("string" == typeof o) {
		return [document.getElementById(o)];
	}
	if (!o.length) return [o];
	var result = [];
	for (var i=0; i<o.length; i++) {
		if ("string" == typeof o[i]) {
			result[i] = document.getElementById(o[i]);
		} else {
			result[i] = o[i];
		}
	}
	return result;
}

Animator.camelize = function(string) {
	var oStringList = string.split('-');
	if (oStringList.length == 1) return oStringList[0];
	
	var camelizedString = string.indexOf('-') == 0
		? oStringList[0].charAt(0).toUpperCase() + oStringList[0].substring(1)
		: oStringList[0];
	
	for (var i = 1, len = oStringList.length; i < len; i++) {
		var s = oStringList[i];
		camelizedString += s.charAt(0).toUpperCase() + s.substring(1);
	}
	return camelizedString;
}

Animator.apply = function(el, style, options) {
	if (style instanceof Array) {
		return new Animator(options).addSubject(new CSSStyleSubject(el, style[0], style[1]));
	}
	return new Animator(options).addSubject(new CSSStyleSubject(el, style));
}

Animator.makeEaseIn = function(a) {
	return function(state) {
		return Math.pow(state, a*2); 
	}
}

Animator.makeEaseOut = function(a) {
	return function(state) {
		return 1 - Math.pow(1 - state, a*2); 
	}
}
Animator.makeElastic = function(bounces) {
	return function(state) {
		state = Animator.tx.easeInOut(state);
		return ((1-Math.cos(state * Math.PI * bounces)) * (1 - state)) + state; 
	}
}
Animator.makeADSR = function(attackEnd, decayEnd, sustainEnd, sustainLevel) {
	if (sustainLevel == null) sustainLevel = 0.5;
	return function(state) {
		if (state < attackEnd) {
			return state / attackEnd;
		}
		if (state < decayEnd) {
			return 1 - ((state - attackEnd) / (decayEnd - attackEnd) * (1 - sustainLevel));
		}
		if (state < sustainEnd) {
			return sustainLevel;
		}
		return sustainLevel * (1 - ((state - sustainEnd) / (1 - sustainEnd)));
	}
}
Animator.makeBounce = function(bounces) {
	var fn = Animator.makeElastic(bounces);
	return function(state) {
		state = fn(state); 
		return state <= 1 ? state : 2-state;
	}
}
 
Animator.tx = {
	easeInOut: function(pos){
		return ((-Math.cos(pos*Math.PI)/2) + 0.5);
	},
	linear: function(x) {
		return x;
	},
	easeIn: Animator.makeEaseIn(1.5),
	easeOut: Animator.makeEaseOut(1.5),
	strongEaseIn: Animator.makeEaseIn(2.5),
	strongEaseOut: Animator.makeEaseOut(2.5),
	elastic: Animator.makeElastic(1),
	veryElastic: Animator.makeElastic(3),
	bouncy: Animator.makeBounce(1),
	veryBouncy: Animator.makeBounce(3)
}

function NumericalStyleSubject(els, property, from, to, units) {
	this.els = Animator.makeArrayOfElements(els);
	this.property = Animator.camelize(property);
	this.from = parseFloat(from);
	this.to = parseFloat(to);
	this.units = units != null ? units : 'px';
}
NumericalStyleSubject.prototype = {
	setState: function(state) {
		var style = this.getStyle(state);
		var visibility = (this.property == 'opacity' && state == 0) ? 'hidden' : '';
		var j=0;
		for (var i=0; i<this.els.length; i++) {
			try {
				this.els[i].style[this.property] = style;
			} catch (e) {
				if (this.property != 'fontWeight') throw e;
			}
			if (j++ > 20) return;
		}
	},
	getStyle: function(state) {
		state = this.from + ((this.to - this.from) * state);
		if (this.property == 'opacity') return state;
		return Math.round(state) + this.units;
	},
	inspect: function() {
		return "\t" + this.property + "(" + this.from + this.units + " to " + this.to + this.units + ")\n";
	}
}

// animates a colour based style property between two hex values
function ColorStyleSubject(els, property, from, to) {
	this.els = Animator.makeArrayOfElements(els);
	this.property = Animator.camelize(property);
	this.to = this.expandColor(to);
	this.from = this.expandColor(from);
	this.origFrom = from;
	this.origTo = to;
}

ColorStyleSubject.prototype = {
	// parse "#FFFF00" to [256, 256, 0]
	expandColor: function(color) {
		var hexColor, red, green, blue;
		hexColor = ColorStyleSubject.parseColor(color);
		if (hexColor) {
			red = parseInt(hexColor.slice(1, 3), 16);
			green = parseInt(hexColor.slice(3, 5), 16);
			blue = parseInt(hexColor.slice(5, 7), 16);
			return [red,green,blue]
		}
		if (window.ANIMATOR_DEBUG) {
			alert("Invalid colour: '" + color + "'");
		}
	},
	getValueForState: function(color, state) {
		return Math.round(this.from[color] + ((this.to[color] - this.from[color]) * state));
	},
	setState: function(state) {
		var color = '#'
				+ ColorStyleSubject.toColorPart(this.getValueForState(0, state))
				+ ColorStyleSubject.toColorPart(this.getValueForState(1, state))
				+ ColorStyleSubject.toColorPart(this.getValueForState(2, state));
		for (var i=0; i<this.els.length; i++) {
			this.els[i].style[this.property] = color;
		}
	},
	inspect: function() {
		return "\t" + this.property + "(" + this.origFrom + " to " + this.origTo + ")\n";
	}
}

ColorStyleSubject.parseColor = function(string) {
	var color = '#', match;
	if(match = ColorStyleSubject.parseColor.rgbRe.exec(string)) {
		var part;
		for (var i=1; i<=3; i++) {
			part = Math.max(0, Math.min(255, parseInt(match[i])));
			color += ColorStyleSubject.toColorPart(part);
		}
		return color;
	}
	if (match = ColorStyleSubject.parseColor.hexRe.exec(string)) {
		if(match[1].length == 3) {
			for (var i=0; i<3; i++) {
				color += match[1].charAt(i) + match[1].charAt(i);
			}
			return color;
		}
		return '#' + match[1];
	}
	return false;
}
// convert a number to a 2 digit hex string
ColorStyleSubject.toColorPart = function(number) {
	if (number > 255) number = 255;
	var digits = number.toString(16);
	if (number < 16) return '0' + digits;
	return digits;
}
ColorStyleSubject.parseColor.rgbRe = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i;
ColorStyleSubject.parseColor.hexRe = /^\#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function DiscreteStyleSubject(els, property, from, to, threshold) {
	this.els = Animator.makeArrayOfElements(els);
	this.property = Animator.camelize(property);
	this.from = from;
	this.to = to;
	this.threshold = threshold || 0.5;
}

DiscreteStyleSubject.prototype = {
	setState: function(state) {
		var j=0;
		for (var i=0; i<this.els.length; i++) {
			this.els[i].style[this.property] = state <= this.threshold ? this.from : this.to; 
		}
	},
	inspect: function() {
		return "\t" + this.property + "(" + this.from + " to " + this.to + " @ " + this.threshold + ")\n";
	}
}

function CSSStyleSubject(els, style1, style2) {
	els = Animator.makeArrayOfElements(els);
	this.subjects = [];
	if (els.length == 0) return;
	var prop, toStyle, fromStyle;
	if (style2) {
		fromStyle = this.parseStyle(style1, els[0]);
		toStyle = this.parseStyle(style2, els[0]);
	} else {
		toStyle = this.parseStyle(style1, els[0]);
		fromStyle = {};
		for (prop in toStyle) {
			fromStyle[prop] = CSSStyleSubject.getStyle(els[0], prop);
		}
	}
	var prop;
	for (prop in fromStyle) {
		if (fromStyle[prop] == toStyle[prop]) {
			delete fromStyle[prop];
			delete toStyle[prop];
		}
	}
	var prop, units, match, type, from, to;
	for (prop in fromStyle) {
		var fromProp = String(fromStyle[prop]);
		var toProp = String(toStyle[prop]);
		if (toStyle[prop] == null) {
			if (window.ANIMATOR_DEBUG) alert("No to style provided for '" + prop + '"');
			continue;
		}		
		if (from = ColorStyleSubject.parseColor(fromProp)) {
			to = ColorStyleSubject.parseColor(toProp);
			type = ColorStyleSubject;
		} else if (fromProp.match(CSSStyleSubject.numericalRe)
				&& toProp.match(CSSStyleSubject.numericalRe)) {
			from = parseFloat(fromProp);
			to = parseFloat(toProp);
			type = NumericalStyleSubject;
			match = CSSStyleSubject.numericalRe.exec(fromProp);
			var reResult = CSSStyleSubject.numericalRe.exec(toProp);
			if (match[1] != null) {
				units = match[1];
			} else if (reResult[1] != null) {
				units = reResult[1];
			} else {
				units = reResult;
			}
		} else if (fromProp.match(CSSStyleSubject.discreteRe)
				&& toProp.match(CSSStyleSubject.discreteRe)) {
			from = fromProp;
			to = toProp;
			type = DiscreteStyleSubject;
			units = 0;  
		} else {
			if (window.ANIMATOR_DEBUG) {
				alert("Unrecognised format for value of "
					+ prop + ": '" + fromStyle[prop] + "'");
			}
			continue;
		}
		this.subjects[this.subjects.length] = new type(els, prop, from, to, units);
	}
}

CSSStyleSubject.prototype = {
	parseStyle: function(style, el) {
		var rtn = {};
		if (style.indexOf(":") != -1) {
			var styles = style.split(";");
			for (var i=0; i<styles.length; i++) {
				var parts = CSSStyleSubject.ruleRe.exec(styles[i]);
				if (parts) {
					rtn[parts[1]] = parts[2];
				}
			}
		}
		else {
			var prop, value, oldClass;
			oldClass = el.className;
			el.className = style;
			for (var i=0; i<CSSStyleSubject.cssProperties.length; i++) {
				prop = CSSStyleSubject.cssProperties[i];
				value = CSSStyleSubject.getStyle(el, prop);
				if (value != null) {
					rtn[prop] = value;
				}
			}
			el.className = oldClass;
		}
		return rtn;
		
	},
	setState: function(state) {
		for (var i=0; i<this.subjects.length; i++) {
			this.subjects[i].setState(state);
		}
	},
	inspect: function() {
		var str = "";
		for (var i=0; i<this.subjects.length; i++) {
			str += this.subjects[i].inspect();
		}
		return str;
	}
}
// get the current value of a css property, 
CSSStyleSubject.getStyle = function(el, property){
	var style;
	if(document.defaultView && document.defaultView.getComputedStyle){
		style = document.defaultView.getComputedStyle(el, "").getPropertyValue(property);
		if (style) {
			return style;
		}
	}
	property = Animator.camelize(property);
	if(el.currentStyle){
		style = el.currentStyle[property];
	}
	return style || el.style[property]
}


CSSStyleSubject.ruleRe = /^\s*([a-zA-Z\-]+)\s*:\s*(\S(.+\S)?)\s*$/;
CSSStyleSubject.numericalRe = /^-?\d+(?:\.\d+)?(%|[a-zA-Z]{2})?$/;
CSSStyleSubject.discreteRe = /^\w+$/;


CSSStyleSubject.cssProperties = ['azimuth','background','background-attachment','background-color','background-image','background-position','background-repeat','border-collapse','border-color','border-spacing','border-style','border-top','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-width','border-right-width','border-bottom-width','border-left-width','border-width','bottom','clear','clip','color','content','cursor','direction','display','elevation','empty-cells','css-float','font','font-family','font-size','font-size-adjust','font-stretch','font-style','font-variant','font-weight','height','left','letter-spacing','line-height','list-style','list-style-image','list-style-position','list-style-type','margin','margin-top','margin-right','margin-bottom','margin-left','max-height','max-width','min-height','min-width','orphans','outline','outline-color','outline-style','outline-width','overflow','padding','padding-top','padding-right','padding-bottom','padding-left','pause','position','right','size','table-layout','text-align','text-decoration','text-indent','text-shadow','text-transform','top','vertical-align','visibility','white-space','width','word-spacing','z-index','opacity','outline-offset','overflow-x','overflow-y'];

function AnimatorChain(animators, options) {
	this.animators = animators;
	this.setOptions(options);
	for (var i=0; i<this.animators.length; i++) {
		this.listenTo(this.animators[i]);
	}
	this.forwards = false;
	this.current = 0;
}

AnimatorChain.prototype = {
	setOptions: function(options) {
		this.options = Animator.applyDefaults({
			resetOnPlay: true
		}, options);
	},
	play: function() {
		this.forwards = true;
		this.current = -1;
		if (this.options.resetOnPlay) {
			for (var i=0; i<this.animators.length; i++) {
				this.animators[i].jumpTo(0);
			}
		}
		this.advance();
	},
	reverse: function() {
		this.forwards = false;
		this.current = this.animators.length;
		if (this.options.resetOnPlay) {
			for (var i=0; i<this.animators.length; i++) {
				this.animators[i].jumpTo(1);
			}
		}
		this.advance();
	},
	toggle: function() {
		if (this.forwards) {
			this.seekTo(0);
		} else {
			this.seekTo(1);
		}
	},
	listenTo: function(animator) {
		var oldOnComplete = animator.options.onComplete;
		var _this = this;
		animator.options.onComplete = function() {
			if (oldOnComplete) oldOnComplete.call(animator);
			_this.advance();
		}
	},
	advance: function() {
		if (this.forwards) {
			if (this.animators[this.current + 1] == null) return;
			this.current++;
			this.animators[this.current].play();
		} else {
			if (this.animators[this.current - 1] == null) return;
			this.current--;
			this.animators[this.current].reverse();
		}
	},
	
	seekTo: function(target) {
		if (target <= 0) {
			this.forwards = false;
			this.animators[this.current].seekTo(0);
		} else {
			this.forwards = true;
			this.animators[this.current].seekTo(1);
		}
	}
};

var PubSub = {
  enable: function(on) {
    on.subscribe = function(target, events) {
      var n, max, event;
      events = is.array(events) ? events : [].slice.call(arguments, 1);
      for(n = 0, max = events.length ; n < max ; n++) {
        event = 'on' + events[n];
        this.subscribers        = this.subscribers        || {};
        this.subscribers[event] = this.subscribers[event] || [];
        this.subscribers[event].push(target);
      }
    };
    on.publish = function(event) {
      event = 'on' + event;
      if (this.subscribers && this.subscribers[event]) {
        var subs = this.subscribers[event],
            args = [].slice.call(arguments, 1),
            n, max, target;
        for(n = 0, max = subs.length ; n < max ; n++) {
          target = subs[n];
          target[event].apply(target, args);
        }
      }
    };
    if (arguments.length > 1)
      on.subscribe(on, [].slice.call(arguments, 1));
  }
};

