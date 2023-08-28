export const id = 836;
export const ids = [836];
export const modules = {

/***/ 1696:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const events_1 = __webpack_require__(2361);
const debug_1 = __importDefault(__webpack_require__(2526));
const promisify_1 = __importDefault(__webpack_require__(5538));
const debug = debug_1.default('agent-base');
function isAgent(v) {
    return Boolean(v) && typeof v.addRequest === 'function';
}
function isSecureEndpoint() {
    const { stack } = new Error();
    if (typeof stack !== 'string')
        return false;
    return stack.split('\n').some(l => l.indexOf('(https.js:') !== -1 || l.indexOf('node:https:') !== -1);
}
function createAgent(callback, opts) {
    return new createAgent.Agent(callback, opts);
}
(function (createAgent) {
    /**
     * Base `http.Agent` implementation.
     * No pooling/keep-alive is implemented by default.
     *
     * @param {Function} callback
     * @api public
     */
    class Agent extends events_1.EventEmitter {
        constructor(callback, _opts) {
            super();
            let opts = _opts;
            if (typeof callback === 'function') {
                this.callback = callback;
            }
            else if (callback) {
                opts = callback;
            }
            // Timeout for the socket to be returned from the callback
            this.timeout = null;
            if (opts && typeof opts.timeout === 'number') {
                this.timeout = opts.timeout;
            }
            // These aren't actually used by `agent-base`, but are required
            // for the TypeScript definition files in `@types/node` :/
            this.maxFreeSockets = 1;
            this.maxSockets = 1;
            this.maxTotalSockets = Infinity;
            this.sockets = {};
            this.freeSockets = {};
            this.requests = {};
            this.options = {};
        }
        get defaultPort() {
            if (typeof this.explicitDefaultPort === 'number') {
                return this.explicitDefaultPort;
            }
            return isSecureEndpoint() ? 443 : 80;
        }
        set defaultPort(v) {
            this.explicitDefaultPort = v;
        }
        get protocol() {
            if (typeof this.explicitProtocol === 'string') {
                return this.explicitProtocol;
            }
            return isSecureEndpoint() ? 'https:' : 'http:';
        }
        set protocol(v) {
            this.explicitProtocol = v;
        }
        callback(req, opts, fn) {
            throw new Error('"agent-base" has no default implementation, you must subclass and override `callback()`');
        }
        /**
         * Called by node-core's "_http_client.js" module when creating
         * a new HTTP request with this Agent instance.
         *
         * @api public
         */
        addRequest(req, _opts) {
            const opts = Object.assign({}, _opts);
            if (typeof opts.secureEndpoint !== 'boolean') {
                opts.secureEndpoint = isSecureEndpoint();
            }
            if (opts.host == null) {
                opts.host = 'localhost';
            }
            if (opts.port == null) {
                opts.port = opts.secureEndpoint ? 443 : 80;
            }
            if (opts.protocol == null) {
                opts.protocol = opts.secureEndpoint ? 'https:' : 'http:';
            }
            if (opts.host && opts.path) {
                // If both a `host` and `path` are specified then it's most
                // likely the result of a `url.parse()` call... we need to
                // remove the `path` portion so that `net.connect()` doesn't
                // attempt to open that as a unix socket file.
                delete opts.path;
            }
            delete opts.agent;
            delete opts.hostname;
            delete opts._defaultAgent;
            delete opts.defaultPort;
            delete opts.createConnection;
            // Hint to use "Connection: close"
            // XXX: non-documented `http` module API :(
            req._last = true;
            req.shouldKeepAlive = false;
            let timedOut = false;
            let timeoutId = null;
            const timeoutMs = opts.timeout || this.timeout;
            const onerror = (err) => {
                if (req._hadError)
                    return;
                req.emit('error', err);
                // For Safety. Some additional errors might fire later on
                // and we need to make sure we don't double-fire the error event.
                req._hadError = true;
            };
            const ontimeout = () => {
                timeoutId = null;
                timedOut = true;
                const err = new Error(`A "socket" was not created for HTTP request before ${timeoutMs}ms`);
                err.code = 'ETIMEOUT';
                onerror(err);
            };
            const callbackError = (err) => {
                if (timedOut)
                    return;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                onerror(err);
            };
            const onsocket = (socket) => {
                if (timedOut)
                    return;
                if (timeoutId != null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (isAgent(socket)) {
                    // `socket` is actually an `http.Agent` instance, so
                    // relinquish responsibility for this `req` to the Agent
                    // from here on
                    debug('Callback returned another Agent instance %o', socket.constructor.name);
                    socket.addRequest(req, opts);
                    return;
                }
                if (socket) {
                    socket.once('free', () => {
                        this.freeSocket(socket, opts);
                    });
                    req.onSocket(socket);
                    return;
                }
                const err = new Error(`no Duplex stream was returned to agent-base for \`${req.method} ${req.path}\``);
                onerror(err);
            };
            if (typeof this.callback !== 'function') {
                onerror(new Error('`callback` is not defined'));
                return;
            }
            if (!this.promisifiedCallback) {
                if (this.callback.length >= 3) {
                    debug('Converting legacy callback function to promise');
                    this.promisifiedCallback = promisify_1.default(this.callback);
                }
                else {
                    this.promisifiedCallback = this.callback;
                }
            }
            if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                timeoutId = setTimeout(ontimeout, timeoutMs);
            }
            if ('port' in opts && typeof opts.port !== 'number') {
                opts.port = Number(opts.port);
            }
            try {
                debug('Resolving socket for %o request: %o', opts.protocol, `${req.method} ${req.path}`);
                Promise.resolve(this.promisifiedCallback(req, opts)).then(onsocket, callbackError);
            }
            catch (err) {
                Promise.reject(err).catch(callbackError);
            }
        }
        freeSocket(socket, opts) {
            debug('Freeing socket %o %o', socket.constructor.name, opts);
            socket.destroy();
        }
        destroy() {
            debug('Destroying agent %o', this.constructor.name);
        }
    }
    createAgent.Agent = Agent;
    // So that `instanceof` works correctly
    createAgent.prototype = createAgent.Agent.prototype;
})(createAgent || (createAgent = {}));
module.exports = createAgent;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 5538:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
function promisify(fn) {
    return function (req, opts) {
        return new Promise((resolve, reject) => {
            fn.call(this, req, opts, (err, rtn) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rtn);
                }
            });
        });
    };
}
exports["default"] = promisify;
//# sourceMappingURL=promisify.js.map

/***/ }),

/***/ 2032:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const fs = __webpack_require__(7147)
const path = __webpack_require__(1017)

/* istanbul ignore next */
const LCHOWN = fs.lchown ? 'lchown' : 'chown'
/* istanbul ignore next */
const LCHOWNSYNC = fs.lchownSync ? 'lchownSync' : 'chownSync'

/* istanbul ignore next */
const needEISDIRHandled = fs.lchown &&
  !process.version.match(/v1[1-9]+\./) &&
  !process.version.match(/v10\.[6-9]/)

const lchownSync = (path, uid, gid) => {
  try {
    return fs[LCHOWNSYNC](path, uid, gid)
  } catch (er) {
    if (er.code !== 'ENOENT')
      throw er
  }
}

/* istanbul ignore next */
const chownSync = (path, uid, gid) => {
  try {
    return fs.chownSync(path, uid, gid)
  } catch (er) {
    if (er.code !== 'ENOENT')
      throw er
  }
}

/* istanbul ignore next */
const handleEISDIR =
  needEISDIRHandled ? (path, uid, gid, cb) => er => {
    // Node prior to v10 had a very questionable implementation of
    // fs.lchown, which would always try to call fs.open on a directory
    // Fall back to fs.chown in those cases.
    if (!er || er.code !== 'EISDIR')
      cb(er)
    else
      fs.chown(path, uid, gid, cb)
  }
  : (_, __, ___, cb) => cb

/* istanbul ignore next */
const handleEISDirSync =
  needEISDIRHandled ? (path, uid, gid) => {
    try {
      return lchownSync(path, uid, gid)
    } catch (er) {
      if (er.code !== 'EISDIR')
        throw er
      chownSync(path, uid, gid)
    }
  }
  : (path, uid, gid) => lchownSync(path, uid, gid)

// fs.readdir could only accept an options object as of node v6
const nodeVersion = process.version
let readdir = (path, options, cb) => fs.readdir(path, options, cb)
let readdirSync = (path, options) => fs.readdirSync(path, options)
/* istanbul ignore next */
if (/^v4\./.test(nodeVersion))
  readdir = (path, options, cb) => fs.readdir(path, cb)

const chown = (cpath, uid, gid, cb) => {
  fs[LCHOWN](cpath, uid, gid, handleEISDIR(cpath, uid, gid, er => {
    // Skip ENOENT error
    cb(er && er.code !== 'ENOENT' ? er : null)
  }))
}

const chownrKid = (p, child, uid, gid, cb) => {
  if (typeof child === 'string')
    return fs.lstat(path.resolve(p, child), (er, stats) => {
      // Skip ENOENT error
      if (er)
        return cb(er.code !== 'ENOENT' ? er : null)
      stats.name = child
      chownrKid(p, stats, uid, gid, cb)
    })

  if (child.isDirectory()) {
    chownr(path.resolve(p, child.name), uid, gid, er => {
      if (er)
        return cb(er)
      const cpath = path.resolve(p, child.name)
      chown(cpath, uid, gid, cb)
    })
  } else {
    const cpath = path.resolve(p, child.name)
    chown(cpath, uid, gid, cb)
  }
}


const chownr = (p, uid, gid, cb) => {
  readdir(p, { withFileTypes: true }, (er, children) => {
    // any error other than ENOTDIR or ENOTSUP means it's not readable,
    // or doesn't exist.  give up.
    if (er) {
      if (er.code === 'ENOENT')
        return cb()
      else if (er.code !== 'ENOTDIR' && er.code !== 'ENOTSUP')
        return cb(er)
    }
    if (er || !children.length)
      return chown(p, uid, gid, cb)

    let len = children.length
    let errState = null
    const then = er => {
      if (errState)
        return
      if (er)
        return cb(errState = er)
      if (-- len === 0)
        return chown(p, uid, gid, cb)
    }

    children.forEach(child => chownrKid(p, child, uid, gid, then))
  })
}

const chownrKidSync = (p, child, uid, gid) => {
  if (typeof child === 'string') {
    try {
      const stats = fs.lstatSync(path.resolve(p, child))
      stats.name = child
      child = stats
    } catch (er) {
      if (er.code === 'ENOENT')
        return
      else
        throw er
    }
  }

  if (child.isDirectory())
    chownrSync(path.resolve(p, child.name), uid, gid)

  handleEISDirSync(path.resolve(p, child.name), uid, gid)
}

const chownrSync = (p, uid, gid) => {
  let children
  try {
    children = readdirSync(p, { withFileTypes: true })
  } catch (er) {
    if (er.code === 'ENOENT')
      return
    else if (er.code === 'ENOTDIR' || er.code === 'ENOTSUP')
      return handleEISDirSync(p, uid, gid)
    else
      throw er
  }

  if (children && children.length)
    children.forEach(child => chownrKidSync(p, child, uid, gid))

  return handleEISDirSync(p, uid, gid)
}

module.exports = chownr
chownr.sync = chownrSync


/***/ }),

/***/ 6700:
/***/ ((module, exports, __webpack_require__) => {

/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (() => {
	let warned = false;

	return () => {
		if (!warned) {
			warned = true;
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}
	};
})();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exports.log = console.debug || console.log || (() => {});

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug');
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = __webpack_require__(2127)(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};


/***/ }),

/***/ 2127:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = __webpack_require__(2757);
	createDebug.destroy = destroy;

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;
		let enableOverride = null;
		let namespacesCache;
		let enabledCache;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return '%';
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.useColors = createDebug.useColors();
		debug.color = createDebug.selectColor(namespace);
		debug.extend = extend;
		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

		Object.defineProperty(debug, 'enabled', {
			enumerable: true,
			configurable: false,
			get: () => {
				if (enableOverride !== null) {
					return enableOverride;
				}
				if (namespacesCache !== createDebug.namespaces) {
					namespacesCache = createDebug.namespaces;
					enabledCache = createDebug.enabled(namespace);
				}

				return enabledCache;
			},
			set: v => {
				enableOverride = v;
			}
		});

		// Env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		return debug;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);
		createDebug.namespaces = namespaces;

		createDebug.names = [];
		createDebug.skips = [];

		let i;
		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		const len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) {
				// ignore empty strings
				continue;
			}

			namespaces = split[i].replace(/\*/g, '.*?');

			if (namespaces[0] === '-') {
				createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
			} else {
				createDebug.names.push(new RegExp('^' + namespaces + '$'));
			}
		}
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names.map(toNamespace),
			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		if (name[name.length - 1] === '*') {
			return true;
		}

		let i;
		let len;

		for (i = 0, len = createDebug.skips.length; i < len; i++) {
			if (createDebug.skips[i].test(name)) {
				return false;
			}
		}

		for (i = 0, len = createDebug.names.length; i < len; i++) {
			if (createDebug.names[i].test(name)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Convert regexp to namespace
	*
	* @param {RegExp} regxep
	* @return {String} namespace
	* @api private
	*/
	function toNamespace(regexp) {
		return regexp.toString()
			.substring(2, regexp.toString().length - 2)
			.replace(/\.\*\?$/, '*');
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	/**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/
	function destroy() {
		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;


/***/ }),

/***/ 2526:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */

if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
	module.exports = __webpack_require__(6700);
} else {
	module.exports = __webpack_require__(712);
}


/***/ }),

/***/ 712:
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */

const tty = __webpack_require__(6224);
const util = __webpack_require__(3837);

/**
 * This is the Node.js implementation of `debug()`.
 */

exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(
	() => {},
	'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
);

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

try {
	// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
	// eslint-disable-next-line import/no-extraneous-dependencies
	const supportsColor = __webpack_require__(4432);

	if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
		exports.colors = [
			20,
			21,
			26,
			27,
			32,
			33,
			38,
			39,
			40,
			41,
			42,
			43,
			44,
			45,
			56,
			57,
			62,
			63,
			68,
			69,
			74,
			75,
			76,
			77,
			78,
			79,
			80,
			81,
			92,
			93,
			98,
			99,
			112,
			113,
			128,
			129,
			134,
			135,
			148,
			149,
			160,
			161,
			162,
			163,
			164,
			165,
			166,
			167,
			168,
			169,
			170,
			171,
			172,
			173,
			178,
			179,
			184,
			185,
			196,
			197,
			198,
			199,
			200,
			201,
			202,
			203,
			204,
			205,
			206,
			207,
			208,
			209,
			214,
			215,
			220,
			221
		];
	}
} catch (error) {
	// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(key => {
	return /^debug_/i.test(key);
}).reduce((obj, key) => {
	// Camel-case
	const prop = key
		.substring(6)
		.toLowerCase()
		.replace(/_([a-z])/g, (_, k) => {
			return k.toUpperCase();
		});

	// Coerce string value into JS value
	let val = process.env[key];
	if (/^(yes|on|true|enabled)$/i.test(val)) {
		val = true;
	} else if (/^(no|off|false|disabled)$/i.test(val)) {
		val = false;
	} else if (val === 'null') {
		val = null;
	} else {
		val = Number(val);
	}

	obj[prop] = val;
	return obj;
}, {});

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
	return 'colors' in exports.inspectOpts ?
		Boolean(exports.inspectOpts.colors) :
		tty.isatty(process.stderr.fd);
}

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	const {namespace: name, useColors} = this;

	if (useColors) {
		const c = this.color;
		const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
		const prefix = `  ${colorCode};1m${name} \u001B[0m`;

		args[0] = prefix + args[0].split('\n').join('\n' + prefix);
		args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
	} else {
		args[0] = getDate() + name + ' ' + args[0];
	}
}

function getDate() {
	if (exports.inspectOpts.hideDate) {
		return '';
	}
	return new Date().toISOString() + ' ';
}

/**
 * Invokes `util.format()` with the specified arguments and writes to stderr.
 */

function log(...args) {
	return process.stderr.write(util.format(...args) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	if (namespaces) {
		process.env.DEBUG = namespaces;
	} else {
		// If you set a process.env field to null or undefined, it gets cast to the
		// string 'null' or 'undefined'. Just delete instead.
		delete process.env.DEBUG;
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
	return process.env.DEBUG;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init(debug) {
	debug.inspectOpts = {};

	const keys = Object.keys(exports.inspectOpts);
	for (let i = 0; i < keys.length; i++) {
		debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
}

module.exports = __webpack_require__(2127)(exports);

const {formatters} = module.exports;

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

formatters.o = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts)
		.split('\n')
		.map(str => str.trim())
		.join(' ');
};

/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */

formatters.O = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts);
};


/***/ }),

/***/ 1354:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


const MiniPass = __webpack_require__(6424)
const EE = (__webpack_require__(2361).EventEmitter)
const fs = __webpack_require__(7147)

let writev = fs.writev
/* istanbul ignore next */
if (!writev) {
  // This entire block can be removed if support for earlier than Node.js
  // 12.9.0 is not needed.
  const binding = process.binding('fs')
  const FSReqWrap = binding.FSReqWrap || binding.FSReqCallback

  writev = (fd, iovec, pos, cb) => {
    const done = (er, bw) => cb(er, bw, iovec)
    const req = new FSReqWrap()
    req.oncomplete = done
    binding.writeBuffers(fd, iovec, pos, req)
  }
}

const _autoClose = Symbol('_autoClose')
const _close = Symbol('_close')
const _ended = Symbol('_ended')
const _fd = Symbol('_fd')
const _finished = Symbol('_finished')
const _flags = Symbol('_flags')
const _flush = Symbol('_flush')
const _handleChunk = Symbol('_handleChunk')
const _makeBuf = Symbol('_makeBuf')
const _mode = Symbol('_mode')
const _needDrain = Symbol('_needDrain')
const _onerror = Symbol('_onerror')
const _onopen = Symbol('_onopen')
const _onread = Symbol('_onread')
const _onwrite = Symbol('_onwrite')
const _open = Symbol('_open')
const _path = Symbol('_path')
const _pos = Symbol('_pos')
const _queue = Symbol('_queue')
const _read = Symbol('_read')
const _readSize = Symbol('_readSize')
const _reading = Symbol('_reading')
const _remain = Symbol('_remain')
const _size = Symbol('_size')
const _write = Symbol('_write')
const _writing = Symbol('_writing')
const _defaultFlag = Symbol('_defaultFlag')
const _errored = Symbol('_errored')

class ReadStream extends MiniPass {
  constructor (path, opt) {
    opt = opt || {}
    super(opt)

    this.readable = true
    this.writable = false

    if (typeof path !== 'string')
      throw new TypeError('path must be a string')

    this[_errored] = false
    this[_fd] = typeof opt.fd === 'number' ? opt.fd : null
    this[_path] = path
    this[_readSize] = opt.readSize || 16*1024*1024
    this[_reading] = false
    this[_size] = typeof opt.size === 'number' ? opt.size : Infinity
    this[_remain] = this[_size]
    this[_autoClose] = typeof opt.autoClose === 'boolean' ?
      opt.autoClose : true

    if (typeof this[_fd] === 'number')
      this[_read]()
    else
      this[_open]()
  }

  get fd () { return this[_fd] }
  get path () { return this[_path] }

  write () {
    throw new TypeError('this is a readable stream')
  }

  end () {
    throw new TypeError('this is a readable stream')
  }

  [_open] () {
    fs.open(this[_path], 'r', (er, fd) => this[_onopen](er, fd))
  }

  [_onopen] (er, fd) {
    if (er)
      this[_onerror](er)
    else {
      this[_fd] = fd
      this.emit('open', fd)
      this[_read]()
    }
  }

  [_makeBuf] () {
    return Buffer.allocUnsafe(Math.min(this[_readSize], this[_remain]))
  }

  [_read] () {
    if (!this[_reading]) {
      this[_reading] = true
      const buf = this[_makeBuf]()
      /* istanbul ignore if */
      if (buf.length === 0)
        return process.nextTick(() => this[_onread](null, 0, buf))
      fs.read(this[_fd], buf, 0, buf.length, null, (er, br, buf) =>
        this[_onread](er, br, buf))
    }
  }

  [_onread] (er, br, buf) {
    this[_reading] = false
    if (er)
      this[_onerror](er)
    else if (this[_handleChunk](br, buf))
      this[_read]()
  }

  [_close] () {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = null
      fs.close(fd, er => er ? this.emit('error', er) : this.emit('close'))
    }
  }

  [_onerror] (er) {
    this[_reading] = true
    this[_close]()
    this.emit('error', er)
  }

  [_handleChunk] (br, buf) {
    let ret = false
    // no effect if infinite
    this[_remain] -= br
    if (br > 0)
      ret = super.write(br < buf.length ? buf.slice(0, br) : buf)

    if (br === 0 || this[_remain] <= 0) {
      ret = false
      this[_close]()
      super.end()
    }

    return ret
  }

  emit (ev, data) {
    switch (ev) {
      case 'prefinish':
      case 'finish':
        break

      case 'drain':
        if (typeof this[_fd] === 'number')
          this[_read]()
        break

      case 'error':
        if (this[_errored])
          return
        this[_errored] = true
        return super.emit(ev, data)

      default:
        return super.emit(ev, data)
    }
  }
}

class ReadStreamSync extends ReadStream {
  [_open] () {
    let threw = true
    try {
      this[_onopen](null, fs.openSync(this[_path], 'r'))
      threw = false
    } finally {
      if (threw)
        this[_close]()
    }
  }

  [_read] () {
    let threw = true
    try {
      if (!this[_reading]) {
        this[_reading] = true
        do {
          const buf = this[_makeBuf]()
          /* istanbul ignore next */
          const br = buf.length === 0 ? 0
            : fs.readSync(this[_fd], buf, 0, buf.length, null)
          if (!this[_handleChunk](br, buf))
            break
        } while (true)
        this[_reading] = false
      }
      threw = false
    } finally {
      if (threw)
        this[_close]()
    }
  }

  [_close] () {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = null
      fs.closeSync(fd)
      this.emit('close')
    }
  }
}

class WriteStream extends EE {
  constructor (path, opt) {
    opt = opt || {}
    super(opt)
    this.readable = false
    this.writable = true
    this[_errored] = false
    this[_writing] = false
    this[_ended] = false
    this[_needDrain] = false
    this[_queue] = []
    this[_path] = path
    this[_fd] = typeof opt.fd === 'number' ? opt.fd : null
    this[_mode] = opt.mode === undefined ? 0o666 : opt.mode
    this[_pos] = typeof opt.start === 'number' ? opt.start : null
    this[_autoClose] = typeof opt.autoClose === 'boolean' ?
      opt.autoClose : true

    // truncating makes no sense when writing into the middle
    const defaultFlag = this[_pos] !== null ? 'r+' : 'w'
    this[_defaultFlag] = opt.flags === undefined
    this[_flags] = this[_defaultFlag] ? defaultFlag : opt.flags

    if (this[_fd] === null)
      this[_open]()
  }

  emit (ev, data) {
    if (ev === 'error') {
      if (this[_errored])
        return
      this[_errored] = true
    }
    return super.emit(ev, data)
  }


  get fd () { return this[_fd] }
  get path () { return this[_path] }

  [_onerror] (er) {
    this[_close]()
    this[_writing] = true
    this.emit('error', er)
  }

  [_open] () {
    fs.open(this[_path], this[_flags], this[_mode],
      (er, fd) => this[_onopen](er, fd))
  }

  [_onopen] (er, fd) {
    if (this[_defaultFlag] &&
        this[_flags] === 'r+' &&
        er && er.code === 'ENOENT') {
      this[_flags] = 'w'
      this[_open]()
    } else if (er)
      this[_onerror](er)
    else {
      this[_fd] = fd
      this.emit('open', fd)
      this[_flush]()
    }
  }

  end (buf, enc) {
    if (buf)
      this.write(buf, enc)

    this[_ended] = true

    // synthetic after-write logic, where drain/finish live
    if (!this[_writing] && !this[_queue].length &&
        typeof this[_fd] === 'number')
      this[_onwrite](null, 0)
    return this
  }

  write (buf, enc) {
    if (typeof buf === 'string')
      buf = Buffer.from(buf, enc)

    if (this[_ended]) {
      this.emit('error', new Error('write() after end()'))
      return false
    }

    if (this[_fd] === null || this[_writing] || this[_queue].length) {
      this[_queue].push(buf)
      this[_needDrain] = true
      return false
    }

    this[_writing] = true
    this[_write](buf)
    return true
  }

  [_write] (buf) {
    fs.write(this[_fd], buf, 0, buf.length, this[_pos], (er, bw) =>
      this[_onwrite](er, bw))
  }

  [_onwrite] (er, bw) {
    if (er)
      this[_onerror](er)
    else {
      if (this[_pos] !== null)
        this[_pos] += bw
      if (this[_queue].length)
        this[_flush]()
      else {
        this[_writing] = false

        if (this[_ended] && !this[_finished]) {
          this[_finished] = true
          this[_close]()
          this.emit('finish')
        } else if (this[_needDrain]) {
          this[_needDrain] = false
          this.emit('drain')
        }
      }
    }
  }

  [_flush] () {
    if (this[_queue].length === 0) {
      if (this[_ended])
        this[_onwrite](null, 0)
    } else if (this[_queue].length === 1)
      this[_write](this[_queue].pop())
    else {
      const iovec = this[_queue]
      this[_queue] = []
      writev(this[_fd], iovec, this[_pos],
        (er, bw) => this[_onwrite](er, bw))
    }
  }

  [_close] () {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = null
      fs.close(fd, er => er ? this.emit('error', er) : this.emit('close'))
    }
  }
}

class WriteStreamSync extends WriteStream {
  [_open] () {
    let fd
    // only wrap in a try{} block if we know we'll retry, to avoid
    // the rethrow obscuring the error's source frame in most cases.
    if (this[_defaultFlag] && this[_flags] === 'r+') {
      try {
        fd = fs.openSync(this[_path], this[_flags], this[_mode])
      } catch (er) {
        if (er.code === 'ENOENT') {
          this[_flags] = 'w'
          return this[_open]()
        } else
          throw er
      }
    } else
      fd = fs.openSync(this[_path], this[_flags], this[_mode])

    this[_onopen](null, fd)
  }

  [_close] () {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = null
      fs.closeSync(fd)
      this.emit('close')
    }
  }

  [_write] (buf) {
    // throw the original, but try to close if it fails
    let threw = true
    try {
      this[_onwrite](null,
        fs.writeSync(this[_fd], buf, 0, buf.length, this[_pos]))
      threw = false
    } finally {
      if (threw)
        try { this[_close]() } catch (_) {}
    }
  }
}

exports.ReadStream = ReadStream
exports.ReadStreamSync = ReadStreamSync

exports.WriteStream = WriteStream
exports.WriteStreamSync = WriteStreamSync


/***/ }),

/***/ 191:
/***/ ((module) => {



module.exports = (flag, argv = process.argv) => {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};


/***/ }),

/***/ 3833:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const net_1 = __importDefault(__webpack_require__(1808));
const tls_1 = __importDefault(__webpack_require__(4404));
const url_1 = __importDefault(__webpack_require__(7310));
const assert_1 = __importDefault(__webpack_require__(9491));
const debug_1 = __importDefault(__webpack_require__(2526));
const agent_base_1 = __webpack_require__(1696);
const parse_proxy_response_1 = __importDefault(__webpack_require__(3293));
const debug = debug_1.default('https-proxy-agent:agent');
/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to
 * the specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * Outgoing HTTP requests are first tunneled through the proxy server using the
 * `CONNECT` HTTP request method to establish a connection to the proxy server,
 * and then the proxy server connects to the destination target and issues the
 * HTTP request from the proxy server.
 *
 * `https:` requests have their socket connection upgraded to TLS once
 * the connection to the proxy server has been established.
 *
 * @api public
 */
class HttpsProxyAgent extends agent_base_1.Agent {
    constructor(_opts) {
        let opts;
        if (typeof _opts === 'string') {
            opts = url_1.default.parse(_opts);
        }
        else {
            opts = _opts;
        }
        if (!opts) {
            throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
        }
        debug('creating new HttpsProxyAgent instance: %o', opts);
        super(opts);
        const proxy = Object.assign({}, opts);
        // If `true`, then connect to the proxy server over TLS.
        // Defaults to `false`.
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);
        // Prefer `hostname` over `host`, and set the `port` if needed.
        proxy.host = proxy.hostname || proxy.host;
        if (typeof proxy.port === 'string') {
            proxy.port = parseInt(proxy.port, 10);
        }
        if (!proxy.port && proxy.host) {
            proxy.port = this.secureProxy ? 443 : 80;
        }
        // ALPN is supported by Node.js >= v5.
        // attempt to negotiate http/1.1 for proxy servers that support http/2
        if (this.secureProxy && !('ALPNProtocols' in proxy)) {
            proxy.ALPNProtocols = ['http 1.1'];
        }
        if (proxy.host && proxy.path) {
            // If both a `host` and `path` are specified then it's most likely
            // the result of a `url.parse()` call... we need to remove the
            // `path` portion so that `net.connect()` doesn't attempt to open
            // that as a Unix socket file.
            delete proxy.path;
            delete proxy.pathname;
        }
        this.proxy = proxy;
    }
    /**
     * Called when the node-core HTTP client library is creating a
     * new HTTP request.
     *
     * @api protected
     */
    callback(req, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { proxy, secureProxy } = this;
            // Create a socket connection to the proxy server.
            let socket;
            if (secureProxy) {
                debug('Creating `tls.Socket`: %o', proxy);
                socket = tls_1.default.connect(proxy);
            }
            else {
                debug('Creating `net.Socket`: %o', proxy);
                socket = net_1.default.connect(proxy);
            }
            const headers = Object.assign({}, proxy.headers);
            const hostname = `${opts.host}:${opts.port}`;
            let payload = `CONNECT ${hostname} HTTP/1.1\r\n`;
            // Inject the `Proxy-Authorization` header if necessary.
            if (proxy.auth) {
                headers['Proxy-Authorization'] = `Basic ${Buffer.from(proxy.auth).toString('base64')}`;
            }
            // The `Host` header should only include the port
            // number when it is not the default port.
            let { host, port, secureEndpoint } = opts;
            if (!isDefaultPort(port, secureEndpoint)) {
                host += `:${port}`;
            }
            headers.Host = host;
            headers.Connection = 'close';
            for (const name of Object.keys(headers)) {
                payload += `${name}: ${headers[name]}\r\n`;
            }
            const proxyResponsePromise = parse_proxy_response_1.default(socket);
            socket.write(`${payload}\r\n`);
            const { statusCode, buffered } = yield proxyResponsePromise;
            if (statusCode === 200) {
                req.once('socket', resume);
                if (opts.secureEndpoint) {
                    // The proxy is connecting to a TLS server, so upgrade
                    // this socket connection to a TLS connection.
                    debug('Upgrading socket connection to TLS');
                    const servername = opts.servername || opts.host;
                    return tls_1.default.connect(Object.assign(Object.assign({}, omit(opts, 'host', 'hostname', 'path', 'port')), { socket,
                        servername }));
                }
                return socket;
            }
            // Some other status code that's not 200... need to re-play the HTTP
            // header "data" events onto the socket once the HTTP machinery is
            // attached so that the node core `http` can parse and handle the
            // error status code.
            // Close the original socket, and a new "fake" socket is returned
            // instead, so that the proxy doesn't get the HTTP request
            // written to it (which may contain `Authorization` headers or other
            // sensitive data).
            //
            // See: https://hackerone.com/reports/541502
            socket.destroy();
            const fakeSocket = new net_1.default.Socket({ writable: false });
            fakeSocket.readable = true;
            // Need to wait for the "socket" event to re-play the "data" events.
            req.once('socket', (s) => {
                debug('replaying proxy buffer for failed request');
                assert_1.default(s.listenerCount('data') > 0);
                // Replay the "buffered" Buffer onto the fake `socket`, since at
                // this point the HTTP module machinery has been hooked up for
                // the user.
                s.push(buffered);
                s.push(null);
            });
            return fakeSocket;
        });
    }
}
exports["default"] = HttpsProxyAgent;
function resume(socket) {
    socket.resume();
}
function isDefaultPort(port, secure) {
    return Boolean((!secure && port === 80) || (secure && port === 443));
}
function isHTTPS(protocol) {
    return typeof protocol === 'string' ? /^https:?$/i.test(protocol) : false;
}
function omit(obj, ...keys) {
    const ret = {};
    let key;
    for (key in obj) {
        if (!keys.includes(key)) {
            ret[key] = obj[key];
        }
    }
    return ret;
}
//# sourceMappingURL=agent.js.map

/***/ }),

/***/ 6181:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const agent_1 = __importDefault(__webpack_require__(3833));
function createHttpsProxyAgent(opts) {
    return new agent_1.default(opts);
}
(function (createHttpsProxyAgent) {
    createHttpsProxyAgent.HttpsProxyAgent = agent_1.default;
    createHttpsProxyAgent.prototype = agent_1.default.prototype;
})(createHttpsProxyAgent || (createHttpsProxyAgent = {}));
module.exports = createHttpsProxyAgent;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 3293:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const debug_1 = __importDefault(__webpack_require__(2526));
const debug = debug_1.default('https-proxy-agent:parse-proxy-response');
function parseProxyResponse(socket) {
    return new Promise((resolve, reject) => {
        // we need to buffer any HTTP traffic that happens with the proxy before we get
        // the CONNECT response, so that if the response is anything other than an "200"
        // response code, then we can re-play the "data" events on the socket once the
        // HTTP parser is hooked up...
        let buffersLength = 0;
        const buffers = [];
        function read() {
            const b = socket.read();
            if (b)
                ondata(b);
            else
                socket.once('readable', read);
        }
        function cleanup() {
            socket.removeListener('end', onend);
            socket.removeListener('error', onerror);
            socket.removeListener('close', onclose);
            socket.removeListener('readable', read);
        }
        function onclose(err) {
            debug('onclose had error %o', err);
        }
        function onend() {
            debug('onend');
        }
        function onerror(err) {
            cleanup();
            debug('onerror %o', err);
            reject(err);
        }
        function ondata(b) {
            buffers.push(b);
            buffersLength += b.length;
            const buffered = Buffer.concat(buffers, buffersLength);
            const endOfHeaders = buffered.indexOf('\r\n\r\n');
            if (endOfHeaders === -1) {
                // keep buffering
                debug('have not received end of HTTP headers yet...');
                read();
                return;
            }
            const firstLine = buffered.toString('ascii', 0, buffered.indexOf('\r\n'));
            const statusCode = +firstLine.split(' ')[1];
            debug('got proxy server response: %o', firstLine);
            resolve({
                statusCode,
                buffered
            });
        }
        socket.on('error', onerror);
        socket.on('close', onclose);
        socket.on('end', onend);
        read();
    });
}
exports["default"] = parseProxyResponse;
//# sourceMappingURL=parse-proxy-response.js.map

/***/ }),

/***/ 6424:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const proc = typeof process === 'object' && process ? process : {
  stdout: null,
  stderr: null,
}
const EE = __webpack_require__(2361)
const Stream = __webpack_require__(2781)
const SD = (__webpack_require__(1576).StringDecoder)

const EOF = Symbol('EOF')
const MAYBE_EMIT_END = Symbol('maybeEmitEnd')
const EMITTED_END = Symbol('emittedEnd')
const EMITTING_END = Symbol('emittingEnd')
const EMITTED_ERROR = Symbol('emittedError')
const CLOSED = Symbol('closed')
const READ = Symbol('read')
const FLUSH = Symbol('flush')
const FLUSHCHUNK = Symbol('flushChunk')
const ENCODING = Symbol('encoding')
const DECODER = Symbol('decoder')
const FLOWING = Symbol('flowing')
const PAUSED = Symbol('paused')
const RESUME = Symbol('resume')
const BUFFERLENGTH = Symbol('bufferLength')
const BUFFERPUSH = Symbol('bufferPush')
const BUFFERSHIFT = Symbol('bufferShift')
const OBJECTMODE = Symbol('objectMode')
const DESTROYED = Symbol('destroyed')
const EMITDATA = Symbol('emitData')
const EMITEND = Symbol('emitEnd')
const EMITEND2 = Symbol('emitEnd2')
const ASYNC = Symbol('async')

const defer = fn => Promise.resolve().then(fn)

// TODO remove when Node v8 support drops
const doIter = global._MP_NO_ITERATOR_SYMBOLS_  !== '1'
const ASYNCITERATOR = doIter && Symbol.asyncIterator
  || Symbol('asyncIterator not implemented')
const ITERATOR = doIter && Symbol.iterator
  || Symbol('iterator not implemented')

// events that mean 'the stream is over'
// these are treated specially, and re-emitted
// if they are listened for after emitting.
const isEndish = ev =>
  ev === 'end' ||
  ev === 'finish' ||
  ev === 'prefinish'

const isArrayBuffer = b => b instanceof ArrayBuffer ||
  typeof b === 'object' &&
  b.constructor &&
  b.constructor.name === 'ArrayBuffer' &&
  b.byteLength >= 0

const isArrayBufferView = b => !Buffer.isBuffer(b) && ArrayBuffer.isView(b)

class Pipe {
  constructor (src, dest, opts) {
    this.src = src
    this.dest = dest
    this.opts = opts
    this.ondrain = () => src[RESUME]()
    dest.on('drain', this.ondrain)
  }
  unpipe () {
    this.dest.removeListener('drain', this.ondrain)
  }
  // istanbul ignore next - only here for the prototype
  proxyErrors () {}
  end () {
    this.unpipe()
    if (this.opts.end)
      this.dest.end()
  }
}

class PipeProxyErrors extends Pipe {
  unpipe () {
    this.src.removeListener('error', this.proxyErrors)
    super.unpipe()
  }
  constructor (src, dest, opts) {
    super(src, dest, opts)
    this.proxyErrors = er => dest.emit('error', er)
    src.on('error', this.proxyErrors)
  }
}

module.exports = class Minipass extends Stream {
  constructor (options) {
    super()
    this[FLOWING] = false
    // whether we're explicitly paused
    this[PAUSED] = false
    this.pipes = []
    this.buffer = []
    this[OBJECTMODE] = options && options.objectMode || false
    if (this[OBJECTMODE])
      this[ENCODING] = null
    else
      this[ENCODING] = options && options.encoding || null
    if (this[ENCODING] === 'buffer')
      this[ENCODING] = null
    this[ASYNC] = options && !!options.async || false
    this[DECODER] = this[ENCODING] ? new SD(this[ENCODING]) : null
    this[EOF] = false
    this[EMITTED_END] = false
    this[EMITTING_END] = false
    this[CLOSED] = false
    this[EMITTED_ERROR] = null
    this.writable = true
    this.readable = true
    this[BUFFERLENGTH] = 0
    this[DESTROYED] = false
  }

  get bufferLength () { return this[BUFFERLENGTH] }

  get encoding () { return this[ENCODING] }
  set encoding (enc) {
    if (this[OBJECTMODE])
      throw new Error('cannot set encoding in objectMode')

    if (this[ENCODING] && enc !== this[ENCODING] &&
        (this[DECODER] && this[DECODER].lastNeed || this[BUFFERLENGTH]))
      throw new Error('cannot change encoding')

    if (this[ENCODING] !== enc) {
      this[DECODER] = enc ? new SD(enc) : null
      if (this.buffer.length)
        this.buffer = this.buffer.map(chunk => this[DECODER].write(chunk))
    }

    this[ENCODING] = enc
  }

  setEncoding (enc) {
    this.encoding = enc
  }

  get objectMode () { return this[OBJECTMODE] }
  set objectMode (om) { this[OBJECTMODE] = this[OBJECTMODE] || !!om }

  get ['async'] () { return this[ASYNC] }
  set ['async'] (a) { this[ASYNC] = this[ASYNC] || !!a }

  write (chunk, encoding, cb) {
    if (this[EOF])
      throw new Error('write after end')

    if (this[DESTROYED]) {
      this.emit('error', Object.assign(
        new Error('Cannot call write after a stream was destroyed'),
        { code: 'ERR_STREAM_DESTROYED' }
      ))
      return true
    }

    if (typeof encoding === 'function')
      cb = encoding, encoding = 'utf8'

    if (!encoding)
      encoding = 'utf8'

    const fn = this[ASYNC] ? defer : f => f()

    // convert array buffers and typed array views into buffers
    // at some point in the future, we may want to do the opposite!
    // leave strings and buffers as-is
    // anything else switches us into object mode
    if (!this[OBJECTMODE] && !Buffer.isBuffer(chunk)) {
      if (isArrayBufferView(chunk))
        chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      else if (isArrayBuffer(chunk))
        chunk = Buffer.from(chunk)
      else if (typeof chunk !== 'string')
        // use the setter so we throw if we have encoding set
        this.objectMode = true
    }

    // handle object mode up front, since it's simpler
    // this yields better performance, fewer checks later.
    if (this[OBJECTMODE]) {
      /* istanbul ignore if - maybe impossible? */
      if (this.flowing && this[BUFFERLENGTH] !== 0)
        this[FLUSH](true)

      if (this.flowing)
        this.emit('data', chunk)
      else
        this[BUFFERPUSH](chunk)

      if (this[BUFFERLENGTH] !== 0)
        this.emit('readable')

      if (cb)
        fn(cb)

      return this.flowing
    }

    // at this point the chunk is a buffer or string
    // don't buffer it up or send it to the decoder
    if (!chunk.length) {
      if (this[BUFFERLENGTH] !== 0)
        this.emit('readable')
      if (cb)
        fn(cb)
      return this.flowing
    }

    // fast-path writing strings of same encoding to a stream with
    // an empty buffer, skipping the buffer/decoder dance
    if (typeof chunk === 'string' &&
        // unless it is a string already ready for us to use
        !(encoding === this[ENCODING] && !this[DECODER].lastNeed)) {
      chunk = Buffer.from(chunk, encoding)
    }

    if (Buffer.isBuffer(chunk) && this[ENCODING])
      chunk = this[DECODER].write(chunk)

    // Note: flushing CAN potentially switch us into not-flowing mode
    if (this.flowing && this[BUFFERLENGTH] !== 0)
      this[FLUSH](true)

    if (this.flowing)
      this.emit('data', chunk)
    else
      this[BUFFERPUSH](chunk)

    if (this[BUFFERLENGTH] !== 0)
      this.emit('readable')

    if (cb)
      fn(cb)

    return this.flowing
  }

  read (n) {
    if (this[DESTROYED])
      return null

    if (this[BUFFERLENGTH] === 0 || n === 0 || n > this[BUFFERLENGTH]) {
      this[MAYBE_EMIT_END]()
      return null
    }

    if (this[OBJECTMODE])
      n = null

    if (this.buffer.length > 1 && !this[OBJECTMODE]) {
      if (this.encoding)
        this.buffer = [this.buffer.join('')]
      else
        this.buffer = [Buffer.concat(this.buffer, this[BUFFERLENGTH])]
    }

    const ret = this[READ](n || null, this.buffer[0])
    this[MAYBE_EMIT_END]()
    return ret
  }

  [READ] (n, chunk) {
    if (n === chunk.length || n === null)
      this[BUFFERSHIFT]()
    else {
      this.buffer[0] = chunk.slice(n)
      chunk = chunk.slice(0, n)
      this[BUFFERLENGTH] -= n
    }

    this.emit('data', chunk)

    if (!this.buffer.length && !this[EOF])
      this.emit('drain')

    return chunk
  }

  end (chunk, encoding, cb) {
    if (typeof chunk === 'function')
      cb = chunk, chunk = null
    if (typeof encoding === 'function')
      cb = encoding, encoding = 'utf8'
    if (chunk)
      this.write(chunk, encoding)
    if (cb)
      this.once('end', cb)
    this[EOF] = true
    this.writable = false

    // if we haven't written anything, then go ahead and emit,
    // even if we're not reading.
    // we'll re-emit if a new 'end' listener is added anyway.
    // This makes MP more suitable to write-only use cases.
    if (this.flowing || !this[PAUSED])
      this[MAYBE_EMIT_END]()
    return this
  }

  // don't let the internal resume be overwritten
  [RESUME] () {
    if (this[DESTROYED])
      return

    this[PAUSED] = false
    this[FLOWING] = true
    this.emit('resume')
    if (this.buffer.length)
      this[FLUSH]()
    else if (this[EOF])
      this[MAYBE_EMIT_END]()
    else
      this.emit('drain')
  }

  resume () {
    return this[RESUME]()
  }

  pause () {
    this[FLOWING] = false
    this[PAUSED] = true
  }

  get destroyed () {
    return this[DESTROYED]
  }

  get flowing () {
    return this[FLOWING]
  }

  get paused () {
    return this[PAUSED]
  }

  [BUFFERPUSH] (chunk) {
    if (this[OBJECTMODE])
      this[BUFFERLENGTH] += 1
    else
      this[BUFFERLENGTH] += chunk.length
    this.buffer.push(chunk)
  }

  [BUFFERSHIFT] () {
    if (this.buffer.length) {
      if (this[OBJECTMODE])
        this[BUFFERLENGTH] -= 1
      else
        this[BUFFERLENGTH] -= this.buffer[0].length
    }
    return this.buffer.shift()
  }

  [FLUSH] (noDrain) {
    do {} while (this[FLUSHCHUNK](this[BUFFERSHIFT]()))

    if (!noDrain && !this.buffer.length && !this[EOF])
      this.emit('drain')
  }

  [FLUSHCHUNK] (chunk) {
    return chunk ? (this.emit('data', chunk), this.flowing) : false
  }

  pipe (dest, opts) {
    if (this[DESTROYED])
      return

    const ended = this[EMITTED_END]
    opts = opts || {}
    if (dest === proc.stdout || dest === proc.stderr)
      opts.end = false
    else
      opts.end = opts.end !== false
    opts.proxyErrors = !!opts.proxyErrors

    // piping an ended stream ends immediately
    if (ended) {
      if (opts.end)
        dest.end()
    } else {
      this.pipes.push(!opts.proxyErrors ? new Pipe(this, dest, opts)
        : new PipeProxyErrors(this, dest, opts))
      if (this[ASYNC])
        defer(() => this[RESUME]())
      else
        this[RESUME]()
    }

    return dest
  }

  unpipe (dest) {
    const p = this.pipes.find(p => p.dest === dest)
    if (p) {
      this.pipes.splice(this.pipes.indexOf(p), 1)
      p.unpipe()
    }
  }

  addListener (ev, fn) {
    return this.on(ev, fn)
  }

  on (ev, fn) {
    const ret = super.on(ev, fn)
    if (ev === 'data' && !this.pipes.length && !this.flowing)
      this[RESUME]()
    else if (ev === 'readable' && this[BUFFERLENGTH] !== 0)
      super.emit('readable')
    else if (isEndish(ev) && this[EMITTED_END]) {
      super.emit(ev)
      this.removeAllListeners(ev)
    } else if (ev === 'error' && this[EMITTED_ERROR]) {
      if (this[ASYNC])
        defer(() => fn.call(this, this[EMITTED_ERROR]))
      else
        fn.call(this, this[EMITTED_ERROR])
    }
    return ret
  }

  get emittedEnd () {
    return this[EMITTED_END]
  }

  [MAYBE_EMIT_END] () {
    if (!this[EMITTING_END] &&
        !this[EMITTED_END] &&
        !this[DESTROYED] &&
        this.buffer.length === 0 &&
        this[EOF]) {
      this[EMITTING_END] = true
      this.emit('end')
      this.emit('prefinish')
      this.emit('finish')
      if (this[CLOSED])
        this.emit('close')
      this[EMITTING_END] = false
    }
  }

  emit (ev, data, ...extra) {
    // error and close are only events allowed after calling destroy()
    if (ev !== 'error' && ev !== 'close' && ev !== DESTROYED && this[DESTROYED])
      return
    else if (ev === 'data') {
      return !data ? false
        : this[ASYNC] ? defer(() => this[EMITDATA](data))
        : this[EMITDATA](data)
    } else if (ev === 'end') {
      return this[EMITEND]()
    } else if (ev === 'close') {
      this[CLOSED] = true
      // don't emit close before 'end' and 'finish'
      if (!this[EMITTED_END] && !this[DESTROYED])
        return
      const ret = super.emit('close')
      this.removeAllListeners('close')
      return ret
    } else if (ev === 'error') {
      this[EMITTED_ERROR] = data
      const ret = super.emit('error', data)
      this[MAYBE_EMIT_END]()
      return ret
    } else if (ev === 'resume') {
      const ret = super.emit('resume')
      this[MAYBE_EMIT_END]()
      return ret
    } else if (ev === 'finish' || ev === 'prefinish') {
      const ret = super.emit(ev)
      this.removeAllListeners(ev)
      return ret
    }

    // Some other unknown event
    const ret = super.emit(ev, data, ...extra)
    this[MAYBE_EMIT_END]()
    return ret
  }

  [EMITDATA] (data) {
    for (const p of this.pipes) {
      if (p.dest.write(data) === false)
        this.pause()
    }
    const ret = super.emit('data', data)
    this[MAYBE_EMIT_END]()
    return ret
  }

  [EMITEND] () {
    if (this[EMITTED_END])
      return

    this[EMITTED_END] = true
    this.readable = false
    if (this[ASYNC])
      defer(() => this[EMITEND2]())
    else
      this[EMITEND2]()
  }

  [EMITEND2] () {
    if (this[DECODER]) {
      const data = this[DECODER].end()
      if (data) {
        for (const p of this.pipes) {
          p.dest.write(data)
        }
        super.emit('data', data)
      }
    }

    for (const p of this.pipes) {
      p.end()
    }
    const ret = super.emit('end')
    this.removeAllListeners('end')
    return ret
  }

  // const all = await stream.collect()
  collect () {
    const buf = []
    if (!this[OBJECTMODE])
      buf.dataLength = 0
    // set the promise first, in case an error is raised
    // by triggering the flow here.
    const p = this.promise()
    this.on('data', c => {
      buf.push(c)
      if (!this[OBJECTMODE])
        buf.dataLength += c.length
    })
    return p.then(() => buf)
  }

  // const data = await stream.concat()
  concat () {
    return this[OBJECTMODE]
      ? Promise.reject(new Error('cannot concat in objectMode'))
      : this.collect().then(buf =>
          this[OBJECTMODE]
            ? Promise.reject(new Error('cannot concat in objectMode'))
            : this[ENCODING] ? buf.join('') : Buffer.concat(buf, buf.dataLength))
  }

  // stream.promise().then(() => done, er => emitted error)
  promise () {
    return new Promise((resolve, reject) => {
      this.on(DESTROYED, () => reject(new Error('stream destroyed')))
      this.on('error', er => reject(er))
      this.on('end', () => resolve())
    })
  }

  // for await (let chunk of stream)
  [ASYNCITERATOR] () {
    const next = () => {
      const res = this.read()
      if (res !== null)
        return Promise.resolve({ done: false, value: res })

      if (this[EOF])
        return Promise.resolve({ done: true })

      let resolve = null
      let reject = null
      const onerr = er => {
        this.removeListener('data', ondata)
        this.removeListener('end', onend)
        reject(er)
      }
      const ondata = value => {
        this.removeListener('error', onerr)
        this.removeListener('end', onend)
        this.pause()
        resolve({ value: value, done: !!this[EOF] })
      }
      const onend = () => {
        this.removeListener('error', onerr)
        this.removeListener('data', ondata)
        resolve({ done: true })
      }
      const ondestroy = () => onerr(new Error('stream destroyed'))
      return new Promise((res, rej) => {
        reject = rej
        resolve = res
        this.once(DESTROYED, ondestroy)
        this.once('error', onerr)
        this.once('end', onend)
        this.once('data', ondata)
      })
    }

    return { next }
  }

  // for (let chunk of stream)
  [ITERATOR] () {
    const next = () => {
      const value = this.read()
      const done = value === null
      return { value, done }
    }
    return { next }
  }

  destroy (er) {
    if (this[DESTROYED]) {
      if (er)
        this.emit('error', er)
      else
        this.emit(DESTROYED)
      return this
    }

    this[DESTROYED] = true

    // throw away all buffered data, it's never coming out
    this.buffer.length = 0
    this[BUFFERLENGTH] = 0

    if (typeof this.close === 'function' && !this[CLOSED])
      this.close()

    if (er)
      this.emit('error', er)
    else // if no error to emit, still reject pending promises
      this.emit(DESTROYED)

    return this
  }

  static isStream (s) {
    return !!s && (s instanceof Minipass || s instanceof Stream ||
      s instanceof EE && (
        typeof s.pipe === 'function' || // readable
        (typeof s.write === 'function' && typeof s.end === 'function') // writable
      ))
  }
}


/***/ }),

/***/ 8759:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


const proc =
  typeof process === 'object' && process
    ? process
    : {
        stdout: null,
        stderr: null,
      }
const EE = __webpack_require__(2361)
const Stream = __webpack_require__(2781)
const stringdecoder = __webpack_require__(1576)
const SD = stringdecoder.StringDecoder

const EOF = Symbol('EOF')
const MAYBE_EMIT_END = Symbol('maybeEmitEnd')
const EMITTED_END = Symbol('emittedEnd')
const EMITTING_END = Symbol('emittingEnd')
const EMITTED_ERROR = Symbol('emittedError')
const CLOSED = Symbol('closed')
const READ = Symbol('read')
const FLUSH = Symbol('flush')
const FLUSHCHUNK = Symbol('flushChunk')
const ENCODING = Symbol('encoding')
const DECODER = Symbol('decoder')
const FLOWING = Symbol('flowing')
const PAUSED = Symbol('paused')
const RESUME = Symbol('resume')
const BUFFER = Symbol('buffer')
const PIPES = Symbol('pipes')
const BUFFERLENGTH = Symbol('bufferLength')
const BUFFERPUSH = Symbol('bufferPush')
const BUFFERSHIFT = Symbol('bufferShift')
const OBJECTMODE = Symbol('objectMode')
// internal event when stream is destroyed
const DESTROYED = Symbol('destroyed')
// internal event when stream has an error
const ERROR = Symbol('error')
const EMITDATA = Symbol('emitData')
const EMITEND = Symbol('emitEnd')
const EMITEND2 = Symbol('emitEnd2')
const ASYNC = Symbol('async')
const ABORT = Symbol('abort')
const ABORTED = Symbol('aborted')
const SIGNAL = Symbol('signal')

const defer = fn => Promise.resolve().then(fn)

// TODO remove when Node v8 support drops
const doIter = global._MP_NO_ITERATOR_SYMBOLS_ !== '1'
const ASYNCITERATOR =
  (doIter && Symbol.asyncIterator) || Symbol('asyncIterator not implemented')
const ITERATOR =
  (doIter && Symbol.iterator) || Symbol('iterator not implemented')

// events that mean 'the stream is over'
// these are treated specially, and re-emitted
// if they are listened for after emitting.
const isEndish = ev => ev === 'end' || ev === 'finish' || ev === 'prefinish'

const isArrayBuffer = b =>
  b instanceof ArrayBuffer ||
  (typeof b === 'object' &&
    b.constructor &&
    b.constructor.name === 'ArrayBuffer' &&
    b.byteLength >= 0)

const isArrayBufferView = b => !Buffer.isBuffer(b) && ArrayBuffer.isView(b)

class Pipe {
  constructor(src, dest, opts) {
    this.src = src
    this.dest = dest
    this.opts = opts
    this.ondrain = () => src[RESUME]()
    dest.on('drain', this.ondrain)
  }
  unpipe() {
    this.dest.removeListener('drain', this.ondrain)
  }
  // istanbul ignore next - only here for the prototype
  proxyErrors() {}
  end() {
    this.unpipe()
    if (this.opts.end) this.dest.end()
  }
}

class PipeProxyErrors extends Pipe {
  unpipe() {
    this.src.removeListener('error', this.proxyErrors)
    super.unpipe()
  }
  constructor(src, dest, opts) {
    super(src, dest, opts)
    this.proxyErrors = er => dest.emit('error', er)
    src.on('error', this.proxyErrors)
  }
}

class Minipass extends Stream {
  constructor(options) {
    super()
    this[FLOWING] = false
    // whether we're explicitly paused
    this[PAUSED] = false
    this[PIPES] = []
    this[BUFFER] = []
    this[OBJECTMODE] = (options && options.objectMode) || false
    if (this[OBJECTMODE]) this[ENCODING] = null
    else this[ENCODING] = (options && options.encoding) || null
    if (this[ENCODING] === 'buffer') this[ENCODING] = null
    this[ASYNC] = (options && !!options.async) || false
    this[DECODER] = this[ENCODING] ? new SD(this[ENCODING]) : null
    this[EOF] = false
    this[EMITTED_END] = false
    this[EMITTING_END] = false
    this[CLOSED] = false
    this[EMITTED_ERROR] = null
    this.writable = true
    this.readable = true
    this[BUFFERLENGTH] = 0
    this[DESTROYED] = false
    if (options && options.debugExposeBuffer === true) {
      Object.defineProperty(this, 'buffer', { get: () => this[BUFFER] })
    }
    if (options && options.debugExposePipes === true) {
      Object.defineProperty(this, 'pipes', { get: () => this[PIPES] })
    }
    this[SIGNAL] = options && options.signal
    this[ABORTED] = false
    if (this[SIGNAL]) {
      this[SIGNAL].addEventListener('abort', () => this[ABORT]())
      if (this[SIGNAL].aborted) {
        this[ABORT]()
      }
    }
  }

  get bufferLength() {
    return this[BUFFERLENGTH]
  }

  get encoding() {
    return this[ENCODING]
  }
  set encoding(enc) {
    if (this[OBJECTMODE]) throw new Error('cannot set encoding in objectMode')

    if (
      this[ENCODING] &&
      enc !== this[ENCODING] &&
      ((this[DECODER] && this[DECODER].lastNeed) || this[BUFFERLENGTH])
    )
      throw new Error('cannot change encoding')

    if (this[ENCODING] !== enc) {
      this[DECODER] = enc ? new SD(enc) : null
      if (this[BUFFER].length)
        this[BUFFER] = this[BUFFER].map(chunk => this[DECODER].write(chunk))
    }

    this[ENCODING] = enc
  }

  setEncoding(enc) {
    this.encoding = enc
  }

  get objectMode() {
    return this[OBJECTMODE]
  }
  set objectMode(om) {
    this[OBJECTMODE] = this[OBJECTMODE] || !!om
  }

  get ['async']() {
    return this[ASYNC]
  }
  set ['async'](a) {
    this[ASYNC] = this[ASYNC] || !!a
  }

  // drop everything and get out of the flow completely
  [ABORT]() {
    this[ABORTED] = true
    this.emit('abort', this[SIGNAL].reason)
    this.destroy(this[SIGNAL].reason)
  }

  get aborted() {
    return this[ABORTED]
  }
  set aborted(_) {}

  write(chunk, encoding, cb) {
    if (this[ABORTED]) return false
    if (this[EOF]) throw new Error('write after end')

    if (this[DESTROYED]) {
      this.emit(
        'error',
        Object.assign(
          new Error('Cannot call write after a stream was destroyed'),
          { code: 'ERR_STREAM_DESTROYED' }
        )
      )
      return true
    }

    if (typeof encoding === 'function') (cb = encoding), (encoding = 'utf8')

    if (!encoding) encoding = 'utf8'

    const fn = this[ASYNC] ? defer : f => f()

    // convert array buffers and typed array views into buffers
    // at some point in the future, we may want to do the opposite!
    // leave strings and buffers as-is
    // anything else switches us into object mode
    if (!this[OBJECTMODE] && !Buffer.isBuffer(chunk)) {
      if (isArrayBufferView(chunk))
        chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      else if (isArrayBuffer(chunk)) chunk = Buffer.from(chunk)
      else if (typeof chunk !== 'string')
        // use the setter so we throw if we have encoding set
        this.objectMode = true
    }

    // handle object mode up front, since it's simpler
    // this yields better performance, fewer checks later.
    if (this[OBJECTMODE]) {
      /* istanbul ignore if - maybe impossible? */
      if (this.flowing && this[BUFFERLENGTH] !== 0) this[FLUSH](true)

      if (this.flowing) this.emit('data', chunk)
      else this[BUFFERPUSH](chunk)

      if (this[BUFFERLENGTH] !== 0) this.emit('readable')

      if (cb) fn(cb)

      return this.flowing
    }

    // at this point the chunk is a buffer or string
    // don't buffer it up or send it to the decoder
    if (!chunk.length) {
      if (this[BUFFERLENGTH] !== 0) this.emit('readable')
      if (cb) fn(cb)
      return this.flowing
    }

    // fast-path writing strings of same encoding to a stream with
    // an empty buffer, skipping the buffer/decoder dance
    if (
      typeof chunk === 'string' &&
      // unless it is a string already ready for us to use
      !(encoding === this[ENCODING] && !this[DECODER].lastNeed)
    ) {
      chunk = Buffer.from(chunk, encoding)
    }

    if (Buffer.isBuffer(chunk) && this[ENCODING])
      chunk = this[DECODER].write(chunk)

    // Note: flushing CAN potentially switch us into not-flowing mode
    if (this.flowing && this[BUFFERLENGTH] !== 0) this[FLUSH](true)

    if (this.flowing) this.emit('data', chunk)
    else this[BUFFERPUSH](chunk)

    if (this[BUFFERLENGTH] !== 0) this.emit('readable')

    if (cb) fn(cb)

    return this.flowing
  }

  read(n) {
    if (this[DESTROYED]) return null

    if (this[BUFFERLENGTH] === 0 || n === 0 || n > this[BUFFERLENGTH]) {
      this[MAYBE_EMIT_END]()
      return null
    }

    if (this[OBJECTMODE]) n = null

    if (this[BUFFER].length > 1 && !this[OBJECTMODE]) {
      if (this.encoding) this[BUFFER] = [this[BUFFER].join('')]
      else this[BUFFER] = [Buffer.concat(this[BUFFER], this[BUFFERLENGTH])]
    }

    const ret = this[READ](n || null, this[BUFFER][0])
    this[MAYBE_EMIT_END]()
    return ret
  }

  [READ](n, chunk) {
    if (n === chunk.length || n === null) this[BUFFERSHIFT]()
    else {
      this[BUFFER][0] = chunk.slice(n)
      chunk = chunk.slice(0, n)
      this[BUFFERLENGTH] -= n
    }

    this.emit('data', chunk)

    if (!this[BUFFER].length && !this[EOF]) this.emit('drain')

    return chunk
  }

  end(chunk, encoding, cb) {
    if (typeof chunk === 'function') (cb = chunk), (chunk = null)
    if (typeof encoding === 'function') (cb = encoding), (encoding = 'utf8')
    if (chunk) this.write(chunk, encoding)
    if (cb) this.once('end', cb)
    this[EOF] = true
    this.writable = false

    // if we haven't written anything, then go ahead and emit,
    // even if we're not reading.
    // we'll re-emit if a new 'end' listener is added anyway.
    // This makes MP more suitable to write-only use cases.
    if (this.flowing || !this[PAUSED]) this[MAYBE_EMIT_END]()
    return this
  }

  // don't let the internal resume be overwritten
  [RESUME]() {
    if (this[DESTROYED]) return

    this[PAUSED] = false
    this[FLOWING] = true
    this.emit('resume')
    if (this[BUFFER].length) this[FLUSH]()
    else if (this[EOF]) this[MAYBE_EMIT_END]()
    else this.emit('drain')
  }

  resume() {
    return this[RESUME]()
  }

  pause() {
    this[FLOWING] = false
    this[PAUSED] = true
  }

  get destroyed() {
    return this[DESTROYED]
  }

  get flowing() {
    return this[FLOWING]
  }

  get paused() {
    return this[PAUSED]
  }

  [BUFFERPUSH](chunk) {
    if (this[OBJECTMODE]) this[BUFFERLENGTH] += 1
    else this[BUFFERLENGTH] += chunk.length
    this[BUFFER].push(chunk)
  }

  [BUFFERSHIFT]() {
    if (this[OBJECTMODE]) this[BUFFERLENGTH] -= 1
    else this[BUFFERLENGTH] -= this[BUFFER][0].length
    return this[BUFFER].shift()
  }

  [FLUSH](noDrain) {
    do {} while (this[FLUSHCHUNK](this[BUFFERSHIFT]()) && this[BUFFER].length)

    if (!noDrain && !this[BUFFER].length && !this[EOF]) this.emit('drain')
  }

  [FLUSHCHUNK](chunk) {
    this.emit('data', chunk)
    return this.flowing
  }

  pipe(dest, opts) {
    if (this[DESTROYED]) return

    const ended = this[EMITTED_END]
    opts = opts || {}
    if (dest === proc.stdout || dest === proc.stderr) opts.end = false
    else opts.end = opts.end !== false
    opts.proxyErrors = !!opts.proxyErrors

    // piping an ended stream ends immediately
    if (ended) {
      if (opts.end) dest.end()
    } else {
      this[PIPES].push(
        !opts.proxyErrors
          ? new Pipe(this, dest, opts)
          : new PipeProxyErrors(this, dest, opts)
      )
      if (this[ASYNC]) defer(() => this[RESUME]())
      else this[RESUME]()
    }

    return dest
  }

  unpipe(dest) {
    const p = this[PIPES].find(p => p.dest === dest)
    if (p) {
      this[PIPES].splice(this[PIPES].indexOf(p), 1)
      p.unpipe()
    }
  }

  addListener(ev, fn) {
    return this.on(ev, fn)
  }

  on(ev, fn) {
    const ret = super.on(ev, fn)
    if (ev === 'data' && !this[PIPES].length && !this.flowing) this[RESUME]()
    else if (ev === 'readable' && this[BUFFERLENGTH] !== 0)
      super.emit('readable')
    else if (isEndish(ev) && this[EMITTED_END]) {
      super.emit(ev)
      this.removeAllListeners(ev)
    } else if (ev === 'error' && this[EMITTED_ERROR]) {
      if (this[ASYNC]) defer(() => fn.call(this, this[EMITTED_ERROR]))
      else fn.call(this, this[EMITTED_ERROR])
    }
    return ret
  }

  get emittedEnd() {
    return this[EMITTED_END]
  }

  [MAYBE_EMIT_END]() {
    if (
      !this[EMITTING_END] &&
      !this[EMITTED_END] &&
      !this[DESTROYED] &&
      this[BUFFER].length === 0 &&
      this[EOF]
    ) {
      this[EMITTING_END] = true
      this.emit('end')
      this.emit('prefinish')
      this.emit('finish')
      if (this[CLOSED]) this.emit('close')
      this[EMITTING_END] = false
    }
  }

  emit(ev, data, ...extra) {
    // error and close are only events allowed after calling destroy()
    if (ev !== 'error' && ev !== 'close' && ev !== DESTROYED && this[DESTROYED])
      return
    else if (ev === 'data') {
      return !this[OBJECTMODE] && !data
        ? false
        : this[ASYNC]
        ? defer(() => this[EMITDATA](data))
        : this[EMITDATA](data)
    } else if (ev === 'end') {
      return this[EMITEND]()
    } else if (ev === 'close') {
      this[CLOSED] = true
      // don't emit close before 'end' and 'finish'
      if (!this[EMITTED_END] && !this[DESTROYED]) return
      const ret = super.emit('close')
      this.removeAllListeners('close')
      return ret
    } else if (ev === 'error') {
      this[EMITTED_ERROR] = data
      super.emit(ERROR, data)
      const ret =
        !this[SIGNAL] || this.listeners('error').length
          ? super.emit('error', data)
          : false
      this[MAYBE_EMIT_END]()
      return ret
    } else if (ev === 'resume') {
      const ret = super.emit('resume')
      this[MAYBE_EMIT_END]()
      return ret
    } else if (ev === 'finish' || ev === 'prefinish') {
      const ret = super.emit(ev)
      this.removeAllListeners(ev)
      return ret
    }

    // Some other unknown event
    const ret = super.emit(ev, data, ...extra)
    this[MAYBE_EMIT_END]()
    return ret
  }

  [EMITDATA](data) {
    for (const p of this[PIPES]) {
      if (p.dest.write(data) === false) this.pause()
    }
    const ret = super.emit('data', data)
    this[MAYBE_EMIT_END]()
    return ret
  }

  [EMITEND]() {
    if (this[EMITTED_END]) return

    this[EMITTED_END] = true
    this.readable = false
    if (this[ASYNC]) defer(() => this[EMITEND2]())
    else this[EMITEND2]()
  }

  [EMITEND2]() {
    if (this[DECODER]) {
      const data = this[DECODER].end()
      if (data) {
        for (const p of this[PIPES]) {
          p.dest.write(data)
        }
        super.emit('data', data)
      }
    }

    for (const p of this[PIPES]) {
      p.end()
    }
    const ret = super.emit('end')
    this.removeAllListeners('end')
    return ret
  }

  // const all = await stream.collect()
  collect() {
    const buf = []
    if (!this[OBJECTMODE]) buf.dataLength = 0
    // set the promise first, in case an error is raised
    // by triggering the flow here.
    const p = this.promise()
    this.on('data', c => {
      buf.push(c)
      if (!this[OBJECTMODE]) buf.dataLength += c.length
    })
    return p.then(() => buf)
  }

  // const data = await stream.concat()
  concat() {
    return this[OBJECTMODE]
      ? Promise.reject(new Error('cannot concat in objectMode'))
      : this.collect().then(buf =>
          this[OBJECTMODE]
            ? Promise.reject(new Error('cannot concat in objectMode'))
            : this[ENCODING]
            ? buf.join('')
            : Buffer.concat(buf, buf.dataLength)
        )
  }

  // stream.promise().then(() => done, er => emitted error)
  promise() {
    return new Promise((resolve, reject) => {
      this.on(DESTROYED, () => reject(new Error('stream destroyed')))
      this.on('error', er => reject(er))
      this.on('end', () => resolve())
    })
  }

  // for await (let chunk of stream)
  [ASYNCITERATOR]() {
    let stopped = false
    const stop = () => {
      this.pause()
      stopped = true
      return Promise.resolve({ done: true })
    }
    const next = () => {
      if (stopped) return stop()
      const res = this.read()
      if (res !== null) return Promise.resolve({ done: false, value: res })

      if (this[EOF]) return stop()

      let resolve = null
      let reject = null
      const onerr = er => {
        this.removeListener('data', ondata)
        this.removeListener('end', onend)
        this.removeListener(DESTROYED, ondestroy)
        stop()
        reject(er)
      }
      const ondata = value => {
        this.removeListener('error', onerr)
        this.removeListener('end', onend)
        this.removeListener(DESTROYED, ondestroy)
        this.pause()
        resolve({ value: value, done: !!this[EOF] })
      }
      const onend = () => {
        this.removeListener('error', onerr)
        this.removeListener('data', ondata)
        this.removeListener(DESTROYED, ondestroy)
        stop()
        resolve({ done: true })
      }
      const ondestroy = () => onerr(new Error('stream destroyed'))
      return new Promise((res, rej) => {
        reject = rej
        resolve = res
        this.once(DESTROYED, ondestroy)
        this.once('error', onerr)
        this.once('end', onend)
        this.once('data', ondata)
      })
    }

    return {
      next,
      throw: stop,
      return: stop,
      [ASYNCITERATOR]() {
        return this
      },
    }
  }

  // for (let chunk of stream)
  [ITERATOR]() {
    let stopped = false
    const stop = () => {
      this.pause()
      this.removeListener(ERROR, stop)
      this.removeListener(DESTROYED, stop)
      this.removeListener('end', stop)
      stopped = true
      return { done: true }
    }

    const next = () => {
      if (stopped) return stop()
      const value = this.read()
      return value === null ? stop() : { value }
    }
    this.once('end', stop)
    this.once(ERROR, stop)
    this.once(DESTROYED, stop)

    return {
      next,
      throw: stop,
      return: stop,
      [ITERATOR]() {
        return this
      },
    }
  }

  destroy(er) {
    if (this[DESTROYED]) {
      if (er) this.emit('error', er)
      else this.emit(DESTROYED)
      return this
    }

    this[DESTROYED] = true

    // throw away all buffered data, it's never coming out
    this[BUFFER].length = 0
    this[BUFFERLENGTH] = 0

    if (typeof this.close === 'function' && !this[CLOSED]) this.close()

    if (er) this.emit('error', er)
    // if no error to emit, still reject pending promises
    else this.emit(DESTROYED)

    return this
  }

  static isStream(s) {
    return (
      !!s &&
      (s instanceof Minipass ||
        s instanceof Stream ||
        (s instanceof EE &&
          // readable
          (typeof s.pipe === 'function' ||
            // writable
            (typeof s.write === 'function' && typeof s.end === 'function'))))
    )
  }
}

exports.Minipass = Minipass


/***/ }),

/***/ 9189:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// Update with any zlib constants that are added or changed in the future.
// Node v6 didn't export this, so we just hard code the version and rely
// on all the other hard-coded values from zlib v4736.  When node v6
// support drops, we can just export the realZlibConstants object.
const realZlibConstants = (__webpack_require__(9796).constants) ||
  /* istanbul ignore next */ { ZLIB_VERNUM: 4736 }

module.exports = Object.freeze(Object.assign(Object.create(null), {
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  Z_VERSION_ERROR: -6,
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  DEFLATE: 1,
  INFLATE: 2,
  GZIP: 3,
  GUNZIP: 4,
  DEFLATERAW: 5,
  INFLATERAW: 6,
  UNZIP: 7,
  BROTLI_DECODE: 8,
  BROTLI_ENCODE: 9,
  Z_MIN_WINDOWBITS: 8,
  Z_MAX_WINDOWBITS: 15,
  Z_DEFAULT_WINDOWBITS: 15,
  Z_MIN_CHUNK: 64,
  Z_MAX_CHUNK: Infinity,
  Z_DEFAULT_CHUNK: 16384,
  Z_MIN_MEMLEVEL: 1,
  Z_MAX_MEMLEVEL: 9,
  Z_DEFAULT_MEMLEVEL: 8,
  Z_MIN_LEVEL: -1,
  Z_MAX_LEVEL: 9,
  Z_DEFAULT_LEVEL: -1,
  BROTLI_OPERATION_PROCESS: 0,
  BROTLI_OPERATION_FLUSH: 1,
  BROTLI_OPERATION_FINISH: 2,
  BROTLI_OPERATION_EMIT_METADATA: 3,
  BROTLI_MODE_GENERIC: 0,
  BROTLI_MODE_TEXT: 1,
  BROTLI_MODE_FONT: 2,
  BROTLI_DEFAULT_MODE: 0,
  BROTLI_MIN_QUALITY: 0,
  BROTLI_MAX_QUALITY: 11,
  BROTLI_DEFAULT_QUALITY: 11,
  BROTLI_MIN_WINDOW_BITS: 10,
  BROTLI_MAX_WINDOW_BITS: 24,
  BROTLI_LARGE_MAX_WINDOW_BITS: 30,
  BROTLI_DEFAULT_WINDOW: 22,
  BROTLI_MIN_INPUT_BLOCK_BITS: 16,
  BROTLI_MAX_INPUT_BLOCK_BITS: 24,
  BROTLI_PARAM_MODE: 0,
  BROTLI_PARAM_QUALITY: 1,
  BROTLI_PARAM_LGWIN: 2,
  BROTLI_PARAM_LGBLOCK: 3,
  BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING: 4,
  BROTLI_PARAM_SIZE_HINT: 5,
  BROTLI_PARAM_LARGE_WINDOW: 6,
  BROTLI_PARAM_NPOSTFIX: 7,
  BROTLI_PARAM_NDIRECT: 8,
  BROTLI_DECODER_RESULT_ERROR: 0,
  BROTLI_DECODER_RESULT_SUCCESS: 1,
  BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT: 2,
  BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT: 3,
  BROTLI_DECODER_PARAM_DISABLE_RING_BUFFER_REALLOCATION: 0,
  BROTLI_DECODER_PARAM_LARGE_WINDOW: 1,
  BROTLI_DECODER_NO_ERROR: 0,
  BROTLI_DECODER_SUCCESS: 1,
  BROTLI_DECODER_NEEDS_MORE_INPUT: 2,
  BROTLI_DECODER_NEEDS_MORE_OUTPUT: 3,
  BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_NIBBLE: -1,
  BROTLI_DECODER_ERROR_FORMAT_RESERVED: -2,
  BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_META_NIBBLE: -3,
  BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_ALPHABET: -4,
  BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_SAME: -5,
  BROTLI_DECODER_ERROR_FORMAT_CL_SPACE: -6,
  BROTLI_DECODER_ERROR_FORMAT_HUFFMAN_SPACE: -7,
  BROTLI_DECODER_ERROR_FORMAT_CONTEXT_MAP_REPEAT: -8,
  BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_1: -9,
  BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_2: -10,
  BROTLI_DECODER_ERROR_FORMAT_TRANSFORM: -11,
  BROTLI_DECODER_ERROR_FORMAT_DICTIONARY: -12,
  BROTLI_DECODER_ERROR_FORMAT_WINDOW_BITS: -13,
  BROTLI_DECODER_ERROR_FORMAT_PADDING_1: -14,
  BROTLI_DECODER_ERROR_FORMAT_PADDING_2: -15,
  BROTLI_DECODER_ERROR_FORMAT_DISTANCE: -16,
  BROTLI_DECODER_ERROR_DICTIONARY_NOT_SET: -19,
  BROTLI_DECODER_ERROR_INVALID_ARGUMENTS: -20,
  BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MODES: -21,
  BROTLI_DECODER_ERROR_ALLOC_TREE_GROUPS: -22,
  BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MAP: -25,
  BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_1: -26,
  BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_2: -27,
  BROTLI_DECODER_ERROR_ALLOC_BLOCK_TYPE_TREES: -30,
  BROTLI_DECODER_ERROR_UNREACHABLE: -31,
}, realZlibConstants))


/***/ }),

/***/ 8925:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



const assert = __webpack_require__(9491)
const Buffer = (__webpack_require__(4300).Buffer)
const realZlib = __webpack_require__(9796)

const constants = exports.constants = __webpack_require__(9189)
const Minipass = __webpack_require__(6424)

const OriginalBufferConcat = Buffer.concat

const _superWrite = Symbol('_superWrite')
class ZlibError extends Error {
  constructor (err) {
    super('zlib: ' + err.message)
    this.code = err.code
    this.errno = err.errno
    /* istanbul ignore if */
    if (!this.code)
      this.code = 'ZLIB_ERROR'

    this.message = 'zlib: ' + err.message
    Error.captureStackTrace(this, this.constructor)
  }

  get name () {
    return 'ZlibError'
  }
}

// the Zlib class they all inherit from
// This thing manages the queue of requests, and returns
// true or false if there is anything in the queue when
// you call the .write() method.
const _opts = Symbol('opts')
const _flushFlag = Symbol('flushFlag')
const _finishFlushFlag = Symbol('finishFlushFlag')
const _fullFlushFlag = Symbol('fullFlushFlag')
const _handle = Symbol('handle')
const _onError = Symbol('onError')
const _sawError = Symbol('sawError')
const _level = Symbol('level')
const _strategy = Symbol('strategy')
const _ended = Symbol('ended')
const _defaultFullFlush = Symbol('_defaultFullFlush')

class ZlibBase extends Minipass {
  constructor (opts, mode) {
    if (!opts || typeof opts !== 'object')
      throw new TypeError('invalid options for ZlibBase constructor')

    super(opts)
    this[_sawError] = false
    this[_ended] = false
    this[_opts] = opts

    this[_flushFlag] = opts.flush
    this[_finishFlushFlag] = opts.finishFlush
    // this will throw if any options are invalid for the class selected
    try {
      this[_handle] = new realZlib[mode](opts)
    } catch (er) {
      // make sure that all errors get decorated properly
      throw new ZlibError(er)
    }

    this[_onError] = (err) => {
      // no sense raising multiple errors, since we abort on the first one.
      if (this[_sawError])
        return

      this[_sawError] = true

      // there is no way to cleanly recover.
      // continuing only obscures problems.
      this.close()
      this.emit('error', err)
    }

    this[_handle].on('error', er => this[_onError](new ZlibError(er)))
    this.once('end', () => this.close)
  }

  close () {
    if (this[_handle]) {
      this[_handle].close()
      this[_handle] = null
      this.emit('close')
    }
  }

  reset () {
    if (!this[_sawError]) {
      assert(this[_handle], 'zlib binding closed')
      return this[_handle].reset()
    }
  }

  flush (flushFlag) {
    if (this.ended)
      return

    if (typeof flushFlag !== 'number')
      flushFlag = this[_fullFlushFlag]
    this.write(Object.assign(Buffer.alloc(0), { [_flushFlag]: flushFlag }))
  }

  end (chunk, encoding, cb) {
    if (chunk)
      this.write(chunk, encoding)
    this.flush(this[_finishFlushFlag])
    this[_ended] = true
    return super.end(null, null, cb)
  }

  get ended () {
    return this[_ended]
  }

  write (chunk, encoding, cb) {
    // process the chunk using the sync process
    // then super.write() all the outputted chunks
    if (typeof encoding === 'function')
      cb = encoding, encoding = 'utf8'

    if (typeof chunk === 'string')
      chunk = Buffer.from(chunk, encoding)

    if (this[_sawError])
      return
    assert(this[_handle], 'zlib binding closed')

    // _processChunk tries to .close() the native handle after it's done, so we
    // intercept that by temporarily making it a no-op.
    const nativeHandle = this[_handle]._handle
    const originalNativeClose = nativeHandle.close
    nativeHandle.close = () => {}
    const originalClose = this[_handle].close
    this[_handle].close = () => {}
    // It also calls `Buffer.concat()` at the end, which may be convenient
    // for some, but which we are not interested in as it slows us down.
    Buffer.concat = (args) => args
    let result
    try {
      const flushFlag = typeof chunk[_flushFlag] === 'number'
        ? chunk[_flushFlag] : this[_flushFlag]
      result = this[_handle]._processChunk(chunk, flushFlag)
      // if we don't throw, reset it back how it was
      Buffer.concat = OriginalBufferConcat
    } catch (err) {
      // or if we do, put Buffer.concat() back before we emit error
      // Error events call into user code, which may call Buffer.concat()
      Buffer.concat = OriginalBufferConcat
      this[_onError](new ZlibError(err))
    } finally {
      if (this[_handle]) {
        // Core zlib resets `_handle` to null after attempting to close the
        // native handle. Our no-op handler prevented actual closure, but we
        // need to restore the `._handle` property.
        this[_handle]._handle = nativeHandle
        nativeHandle.close = originalNativeClose
        this[_handle].close = originalClose
        // `_processChunk()` adds an 'error' listener. If we don't remove it
        // after each call, these handlers start piling up.
        this[_handle].removeAllListeners('error')
        // make sure OUR error listener is still attached tho
      }
    }

    if (this[_handle])
      this[_handle].on('error', er => this[_onError](new ZlibError(er)))

    let writeReturn
    if (result) {
      if (Array.isArray(result) && result.length > 0) {
        // The first buffer is always `handle._outBuffer`, which would be
        // re-used for later invocations; so, we always have to copy that one.
        writeReturn = this[_superWrite](Buffer.from(result[0]))
        for (let i = 1; i < result.length; i++) {
          writeReturn = this[_superWrite](result[i])
        }
      } else {
        writeReturn = this[_superWrite](Buffer.from(result))
      }
    }

    if (cb)
      cb()
    return writeReturn
  }

  [_superWrite] (data) {
    return super.write(data)
  }
}

class Zlib extends ZlibBase {
  constructor (opts, mode) {
    opts = opts || {}

    opts.flush = opts.flush || constants.Z_NO_FLUSH
    opts.finishFlush = opts.finishFlush || constants.Z_FINISH
    super(opts, mode)

    this[_fullFlushFlag] = constants.Z_FULL_FLUSH
    this[_level] = opts.level
    this[_strategy] = opts.strategy
  }

  params (level, strategy) {
    if (this[_sawError])
      return

    if (!this[_handle])
      throw new Error('cannot switch params when binding is closed')

    // no way to test this without also not supporting params at all
    /* istanbul ignore if */
    if (!this[_handle].params)
      throw new Error('not supported in this implementation')

    if (this[_level] !== level || this[_strategy] !== strategy) {
      this.flush(constants.Z_SYNC_FLUSH)
      assert(this[_handle], 'zlib binding closed')
      // .params() calls .flush(), but the latter is always async in the
      // core zlib. We override .flush() temporarily to intercept that and
      // flush synchronously.
      const origFlush = this[_handle].flush
      this[_handle].flush = (flushFlag, cb) => {
        this.flush(flushFlag)
        cb()
      }
      try {
        this[_handle].params(level, strategy)
      } finally {
        this[_handle].flush = origFlush
      }
      /* istanbul ignore else */
      if (this[_handle]) {
        this[_level] = level
        this[_strategy] = strategy
      }
    }
  }
}

// minimal 2-byte header
class Deflate extends Zlib {
  constructor (opts) {
    super(opts, 'Deflate')
  }
}

class Inflate extends Zlib {
  constructor (opts) {
    super(opts, 'Inflate')
  }
}

// gzip - bigger header, same deflate compression
const _portable = Symbol('_portable')
class Gzip extends Zlib {
  constructor (opts) {
    super(opts, 'Gzip')
    this[_portable] = opts && !!opts.portable
  }

  [_superWrite] (data) {
    if (!this[_portable])
      return super[_superWrite](data)

    // we'll always get the header emitted in one first chunk
    // overwrite the OS indicator byte with 0xFF
    this[_portable] = false
    data[9] = 255
    return super[_superWrite](data)
  }
}

class Gunzip extends Zlib {
  constructor (opts) {
    super(opts, 'Gunzip')
  }
}

// raw - no header
class DeflateRaw extends Zlib {
  constructor (opts) {
    super(opts, 'DeflateRaw')
  }
}

class InflateRaw extends Zlib {
  constructor (opts) {
    super(opts, 'InflateRaw')
  }
}

// auto-detect header.
class Unzip extends Zlib {
  constructor (opts) {
    super(opts, 'Unzip')
  }
}

class Brotli extends ZlibBase {
  constructor (opts, mode) {
    opts = opts || {}

    opts.flush = opts.flush || constants.BROTLI_OPERATION_PROCESS
    opts.finishFlush = opts.finishFlush || constants.BROTLI_OPERATION_FINISH

    super(opts, mode)

    this[_fullFlushFlag] = constants.BROTLI_OPERATION_FLUSH
  }
}

class BrotliCompress extends Brotli {
  constructor (opts) {
    super(opts, 'BrotliCompress')
  }
}

class BrotliDecompress extends Brotli {
  constructor (opts) {
    super(opts, 'BrotliDecompress')
  }
}

exports.Deflate = Deflate
exports.Inflate = Inflate
exports.Gzip = Gzip
exports.Gunzip = Gunzip
exports.DeflateRaw = DeflateRaw
exports.InflateRaw = InflateRaw
exports.Unzip = Unzip
/* istanbul ignore else */
if (typeof realZlib.BrotliCompress === 'function') {
  exports.BrotliCompress = BrotliCompress
  exports.BrotliDecompress = BrotliDecompress
} else {
  exports.BrotliCompress = exports.BrotliDecompress = class {
    constructor () {
      throw new Error('Brotli is not supported in this version of Node.js')
    }
  }
}


/***/ }),

/***/ 760:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const optsArg = __webpack_require__(8105)
const pathArg = __webpack_require__(6727)

const {mkdirpNative, mkdirpNativeSync} = __webpack_require__(9436)
const {mkdirpManual, mkdirpManualSync} = __webpack_require__(8821)
const {useNative, useNativeSync} = __webpack_require__(7871)


const mkdirp = (path, opts) => {
  path = pathArg(path)
  opts = optsArg(opts)
  return useNative(opts)
    ? mkdirpNative(path, opts)
    : mkdirpManual(path, opts)
}

const mkdirpSync = (path, opts) => {
  path = pathArg(path)
  opts = optsArg(opts)
  return useNativeSync(opts)
    ? mkdirpNativeSync(path, opts)
    : mkdirpManualSync(path, opts)
}

mkdirp.sync = mkdirpSync
mkdirp.native = (path, opts) => mkdirpNative(pathArg(path), optsArg(opts))
mkdirp.manual = (path, opts) => mkdirpManual(pathArg(path), optsArg(opts))
mkdirp.nativeSync = (path, opts) => mkdirpNativeSync(pathArg(path), optsArg(opts))
mkdirp.manualSync = (path, opts) => mkdirpManualSync(pathArg(path), optsArg(opts))

module.exports = mkdirp


/***/ }),

/***/ 8434:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const {dirname} = __webpack_require__(1017)

const findMade = (opts, parent, path = undefined) => {
  // we never want the 'made' return value to be a root directory
  if (path === parent)
    return Promise.resolve()

  return opts.statAsync(parent).then(
    st => st.isDirectory() ? path : undefined, // will fail later
    er => er.code === 'ENOENT'
      ? findMade(opts, dirname(parent), parent)
      : undefined
  )
}

const findMadeSync = (opts, parent, path = undefined) => {
  if (path === parent)
    return undefined

  try {
    return opts.statSync(parent).isDirectory() ? path : undefined
  } catch (er) {
    return er.code === 'ENOENT'
      ? findMadeSync(opts, dirname(parent), parent)
      : undefined
  }
}

module.exports = {findMade, findMadeSync}


/***/ }),

/***/ 8821:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const {dirname} = __webpack_require__(1017)

const mkdirpManual = (path, opts, made) => {
  opts.recursive = false
  const parent = dirname(path)
  if (parent === path) {
    return opts.mkdirAsync(path, opts).catch(er => {
      // swallowed by recursive implementation on posix systems
      // any other error is a failure
      if (er.code !== 'EISDIR')
        throw er
    })
  }

  return opts.mkdirAsync(path, opts).then(() => made || path, er => {
    if (er.code === 'ENOENT')
      return mkdirpManual(parent, opts)
        .then(made => mkdirpManual(path, opts, made))
    if (er.code !== 'EEXIST' && er.code !== 'EROFS')
      throw er
    return opts.statAsync(path).then(st => {
      if (st.isDirectory())
        return made
      else
        throw er
    }, () => { throw er })
  })
}

const mkdirpManualSync = (path, opts, made) => {
  const parent = dirname(path)
  opts.recursive = false

  if (parent === path) {
    try {
      return opts.mkdirSync(path, opts)
    } catch (er) {
      // swallowed by recursive implementation on posix systems
      // any other error is a failure
      if (er.code !== 'EISDIR')
        throw er
      else
        return
    }
  }

  try {
    opts.mkdirSync(path, opts)
    return made || path
  } catch (er) {
    if (er.code === 'ENOENT')
      return mkdirpManualSync(path, opts, mkdirpManualSync(parent, opts, made))
    if (er.code !== 'EEXIST' && er.code !== 'EROFS')
      throw er
    try {
      if (!opts.statSync(path).isDirectory())
        throw er
    } catch (_) {
      throw er
    }
  }
}

module.exports = {mkdirpManual, mkdirpManualSync}


/***/ }),

/***/ 9436:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const {dirname} = __webpack_require__(1017)
const {findMade, findMadeSync} = __webpack_require__(8434)
const {mkdirpManual, mkdirpManualSync} = __webpack_require__(8821)

const mkdirpNative = (path, opts) => {
  opts.recursive = true
  const parent = dirname(path)
  if (parent === path)
    return opts.mkdirAsync(path, opts)

  return findMade(opts, path).then(made =>
    opts.mkdirAsync(path, opts).then(() => made)
    .catch(er => {
      if (er.code === 'ENOENT')
        return mkdirpManual(path, opts)
      else
        throw er
    }))
}

const mkdirpNativeSync = (path, opts) => {
  opts.recursive = true
  const parent = dirname(path)
  if (parent === path)
    return opts.mkdirSync(path, opts)

  const made = findMadeSync(opts, path)
  try {
    opts.mkdirSync(path, opts)
    return made
  } catch (er) {
    if (er.code === 'ENOENT')
      return mkdirpManualSync(path, opts)
    else
      throw er
  }
}

module.exports = {mkdirpNative, mkdirpNativeSync}


/***/ }),

/***/ 8105:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { promisify } = __webpack_require__(3837)
const fs = __webpack_require__(7147)
const optsArg = opts => {
  if (!opts)
    opts = { mode: 0o777, fs }
  else if (typeof opts === 'object')
    opts = { mode: 0o777, fs, ...opts }
  else if (typeof opts === 'number')
    opts = { mode: opts, fs }
  else if (typeof opts === 'string')
    opts = { mode: parseInt(opts, 8), fs }
  else
    throw new TypeError('invalid options argument')

  opts.mkdir = opts.mkdir || opts.fs.mkdir || fs.mkdir
  opts.mkdirAsync = promisify(opts.mkdir)
  opts.stat = opts.stat || opts.fs.stat || fs.stat
  opts.statAsync = promisify(opts.stat)
  opts.statSync = opts.statSync || opts.fs.statSync || fs.statSync
  opts.mkdirSync = opts.mkdirSync || opts.fs.mkdirSync || fs.mkdirSync
  return opts
}
module.exports = optsArg


/***/ }),

/***/ 6727:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const platform = process.env.__TESTING_MKDIRP_PLATFORM__ || process.platform
const { resolve, parse } = __webpack_require__(1017)
const pathArg = path => {
  if (/\0/.test(path)) {
    // simulate same failure that node raises
    throw Object.assign(
      new TypeError('path must be a string without null bytes'),
      {
        path,
        code: 'ERR_INVALID_ARG_VALUE',
      }
    )
  }

  path = resolve(path)
  if (platform === 'win32') {
    const badWinChars = /[*|"<>?:]/
    const {root} = parse(path)
    if (badWinChars.test(path.substr(root.length))) {
      throw Object.assign(new Error('Illegal characters in path.'), {
        path,
        code: 'EINVAL',
      })
    }
  }

  return path
}
module.exports = pathArg


/***/ }),

/***/ 7871:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const fs = __webpack_require__(7147)

const version = process.env.__TESTING_MKDIRP_NODE_VERSION__ || process.version
const versArr = version.replace(/^v/, '').split('.')
const hasNative = +versArr[0] > 10 || +versArr[0] === 10 && +versArr[1] >= 12

const useNative = !hasNative ? () => false : opts => opts.mkdir === fs.mkdir
const useNativeSync = !hasNative ? () => false : opts => opts.mkdirSync === fs.mkdirSync

module.exports = {useNative, useNativeSync}


/***/ }),

/***/ 2757:
/***/ ((module) => {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}


/***/ }),

/***/ 4432:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const os = __webpack_require__(2037);
const tty = __webpack_require__(6224);
const hasFlag = __webpack_require__(191);

const {env} = process;

let forceColor;
if (hasFlag('no-color') ||
	hasFlag('no-colors') ||
	hasFlag('color=false') ||
	hasFlag('color=never')) {
	forceColor = 0;
} else if (hasFlag('color') ||
	hasFlag('colors') ||
	hasFlag('color=true') ||
	hasFlag('color=always')) {
	forceColor = 1;
}

if ('FORCE_COLOR' in env) {
	if (env.FORCE_COLOR === 'true') {
		forceColor = 1;
	} else if (env.FORCE_COLOR === 'false') {
		forceColor = 0;
	} else {
		forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3
	};
}

function supportsColor(haveStream, streamIsTTY) {
	if (forceColor === 0) {
		return 0;
	}

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) {
		return 2;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10 &&
			Number(osRelease[2]) >= 10586
		) {
			return Number(osRelease[2]) >= 14931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function getSupportLevel(stream) {
	const level = supportsColor(stream, stream && stream.isTTY);
	return translateLevel(level);
}

module.exports = {
	supportsColor: getSupportLevel,
	stdout: translateLevel(supportsColor(true, tty.isatty(1))),
	stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};


/***/ }),

/***/ 6620:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var __webpack_unused_export__;


// high-level commands
__webpack_unused_export__ = /* unused reexport */ __webpack_require__(3759)
__webpack_unused_export__ = /* unused reexport */ __webpack_require__(6562)
__webpack_unused_export__ = /* unused reexport */ __webpack_require__(7991)
__webpack_unused_export__ = /* unused reexport */ __webpack_require__(7488)
__webpack_unused_export__ = exports.extract = __webpack_require__(7957)

// classes
/* unused reexport */ __webpack_require__(5745)
/* unused reexport */ __webpack_require__(9800)
/* unused reexport */ __webpack_require__(3576)
/* unused reexport */ __webpack_require__(1774)
/* unused reexport */ __webpack_require__(6900)
/* unused reexport */ __webpack_require__(9868)
/* unused reexport */ __webpack_require__(476)
/* unused reexport */ __webpack_require__(2976)


/***/ }),

/***/ 3759:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// tar -c
const hlo = __webpack_require__(8052)

const Pack = __webpack_require__(5745)
const fsm = __webpack_require__(1354)
const t = __webpack_require__(7991)
const path = __webpack_require__(1017)

module.exports = (opt_, files, cb) => {
  if (typeof files === 'function') {
    cb = files
  }

  if (Array.isArray(opt_)) {
    files = opt_, opt_ = {}
  }

  if (!files || !Array.isArray(files) || !files.length) {
    throw new TypeError('no files or directories specified')
  }

  files = Array.from(files)

  const opt = hlo(opt_)

  if (opt.sync && typeof cb === 'function') {
    throw new TypeError('callback not supported for sync tar functions')
  }

  if (!opt.file && typeof cb === 'function') {
    throw new TypeError('callback only supported with file option')
  }

  return opt.file && opt.sync ? createFileSync(opt, files)
    : opt.file ? createFile(opt, files, cb)
    : opt.sync ? createSync(opt, files)
    : create(opt, files)
}

const createFileSync = (opt, files) => {
  const p = new Pack.Sync(opt)
  const stream = new fsm.WriteStreamSync(opt.file, {
    mode: opt.mode || 0o666,
  })
  p.pipe(stream)
  addFilesSync(p, files)
}

const createFile = (opt, files, cb) => {
  const p = new Pack(opt)
  const stream = new fsm.WriteStream(opt.file, {
    mode: opt.mode || 0o666,
  })
  p.pipe(stream)

  const promise = new Promise((res, rej) => {
    stream.on('error', rej)
    stream.on('close', res)
    p.on('error', rej)
  })

  addFilesAsync(p, files)

  return cb ? promise.then(cb, cb) : promise
}

const addFilesSync = (p, files) => {
  files.forEach(file => {
    if (file.charAt(0) === '@') {
      t({
        file: path.resolve(p.cwd, file.slice(1)),
        sync: true,
        noResume: true,
        onentry: entry => p.add(entry),
      })
    } else {
      p.add(file)
    }
  })
  p.end()
}

const addFilesAsync = (p, files) => {
  while (files.length) {
    const file = files.shift()
    if (file.charAt(0) === '@') {
      return t({
        file: path.resolve(p.cwd, file.slice(1)),
        noResume: true,
        onentry: entry => p.add(entry),
      }).then(_ => addFilesAsync(p, files))
    } else {
      p.add(file)
    }
  }
  p.end()
}

const createSync = (opt, files) => {
  const p = new Pack.Sync(opt)
  addFilesSync(p, files)
  return p
}

const create = (opt, files) => {
  const p = new Pack(opt)
  addFilesAsync(p, files)
  return p
}


/***/ }),

/***/ 7957:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// tar -x
const hlo = __webpack_require__(8052)
const Unpack = __webpack_require__(9800)
const fs = __webpack_require__(7147)
const fsm = __webpack_require__(1354)
const path = __webpack_require__(1017)
const stripSlash = __webpack_require__(9812)

module.exports = (opt_, files, cb) => {
  if (typeof opt_ === 'function') {
    cb = opt_, files = null, opt_ = {}
  } else if (Array.isArray(opt_)) {
    files = opt_, opt_ = {}
  }

  if (typeof files === 'function') {
    cb = files, files = null
  }

  if (!files) {
    files = []
  } else {
    files = Array.from(files)
  }

  const opt = hlo(opt_)

  if (opt.sync && typeof cb === 'function') {
    throw new TypeError('callback not supported for sync tar functions')
  }

  if (!opt.file && typeof cb === 'function') {
    throw new TypeError('callback only supported with file option')
  }

  if (files.length) {
    filesFilter(opt, files)
  }

  return opt.file && opt.sync ? extractFileSync(opt)
    : opt.file ? extractFile(opt, cb)
    : opt.sync ? extractSync(opt)
    : extract(opt)
}

// construct a filter that limits the file entries listed
// include child entries if a dir is included
const filesFilter = (opt, files) => {
  const map = new Map(files.map(f => [stripSlash(f), true]))
  const filter = opt.filter

  const mapHas = (file, r) => {
    const root = r || path.parse(file).root || '.'
    const ret = file === root ? false
      : map.has(file) ? map.get(file)
      : mapHas(path.dirname(file), root)

    map.set(file, ret)
    return ret
  }

  opt.filter = filter
    ? (file, entry) => filter(file, entry) && mapHas(stripSlash(file))
    : file => mapHas(stripSlash(file))
}

const extractFileSync = opt => {
  const u = new Unpack.Sync(opt)

  const file = opt.file
  const stat = fs.statSync(file)
  // This trades a zero-byte read() syscall for a stat
  // However, it will usually result in less memory allocation
  const readSize = opt.maxReadSize || 16 * 1024 * 1024
  const stream = new fsm.ReadStreamSync(file, {
    readSize: readSize,
    size: stat.size,
  })
  stream.pipe(u)
}

const extractFile = (opt, cb) => {
  const u = new Unpack(opt)
  const readSize = opt.maxReadSize || 16 * 1024 * 1024

  const file = opt.file
  const p = new Promise((resolve, reject) => {
    u.on('error', reject)
    u.on('close', resolve)

    // This trades a zero-byte read() syscall for a stat
    // However, it will usually result in less memory allocation
    fs.stat(file, (er, stat) => {
      if (er) {
        reject(er)
      } else {
        const stream = new fsm.ReadStream(file, {
          readSize: readSize,
          size: stat.size,
        })
        stream.on('error', reject)
        stream.pipe(u)
      }
    })
  })
  return cb ? p.then(cb, cb) : p
}

const extractSync = opt => new Unpack.Sync(opt)

const extract = opt => new Unpack(opt)


/***/ }),

/***/ 9592:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// Get the appropriate flag to use for creating files
// We use fmap on Windows platforms for files less than
// 512kb.  This is a fairly low limit, but avoids making
// things slower in some cases.  Since most of what this
// library is used for is extracting tarballs of many
// relatively small files in npm packages and the like,
// it can be a big boost on Windows platforms.
// Only supported in Node v12.9.0 and above.
const platform = process.env.__FAKE_PLATFORM__ || process.platform
const isWindows = platform === 'win32'
const fs = global.__FAKE_TESTING_FS__ || __webpack_require__(7147)

/* istanbul ignore next */
const { O_CREAT, O_TRUNC, O_WRONLY, UV_FS_O_FILEMAP = 0 } = fs.constants

const fMapEnabled = isWindows && !!UV_FS_O_FILEMAP
const fMapLimit = 512 * 1024
const fMapFlag = UV_FS_O_FILEMAP | O_TRUNC | O_CREAT | O_WRONLY
module.exports = !fMapEnabled ? () => 'w'
  : size => size < fMapLimit ? fMapFlag : 'w'


/***/ }),

/***/ 9868:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


// parse a 512-byte header block to a data object, or vice-versa
// encode returns `true` if a pax extended header is needed, because
// the data could not be faithfully encoded in a simple header.
// (Also, check header.needPax to see if it needs a pax header.)

const types = __webpack_require__(2976)
const pathModule = (__webpack_require__(1017).posix)
const large = __webpack_require__(8156)

const SLURP = Symbol('slurp')
const TYPE = Symbol('type')

class Header {
  constructor (data, off, ex, gex) {
    this.cksumValid = false
    this.needPax = false
    this.nullBlock = false

    this.block = null
    this.path = null
    this.mode = null
    this.uid = null
    this.gid = null
    this.size = null
    this.mtime = null
    this.cksum = null
    this[TYPE] = '0'
    this.linkpath = null
    this.uname = null
    this.gname = null
    this.devmaj = 0
    this.devmin = 0
    this.atime = null
    this.ctime = null

    if (Buffer.isBuffer(data)) {
      this.decode(data, off || 0, ex, gex)
    } else if (data) {
      this.set(data)
    }
  }

  decode (buf, off, ex, gex) {
    if (!off) {
      off = 0
    }

    if (!buf || !(buf.length >= off + 512)) {
      throw new Error('need 512 bytes for header')
    }

    this.path = decString(buf, off, 100)
    this.mode = decNumber(buf, off + 100, 8)
    this.uid = decNumber(buf, off + 108, 8)
    this.gid = decNumber(buf, off + 116, 8)
    this.size = decNumber(buf, off + 124, 12)
    this.mtime = decDate(buf, off + 136, 12)
    this.cksum = decNumber(buf, off + 148, 12)

    // if we have extended or global extended headers, apply them now
    // See https://github.com/npm/node-tar/pull/187
    this[SLURP](ex)
    this[SLURP](gex, true)

    // old tar versions marked dirs as a file with a trailing /
    this[TYPE] = decString(buf, off + 156, 1)
    if (this[TYPE] === '') {
      this[TYPE] = '0'
    }
    if (this[TYPE] === '0' && this.path.slice(-1) === '/') {
      this[TYPE] = '5'
    }

    // tar implementations sometimes incorrectly put the stat(dir).size
    // as the size in the tarball, even though Directory entries are
    // not able to have any body at all.  In the very rare chance that
    // it actually DOES have a body, we weren't going to do anything with
    // it anyway, and it'll just be a warning about an invalid header.
    if (this[TYPE] === '5') {
      this.size = 0
    }

    this.linkpath = decString(buf, off + 157, 100)
    if (buf.slice(off + 257, off + 265).toString() === 'ustar\u000000') {
      this.uname = decString(buf, off + 265, 32)
      this.gname = decString(buf, off + 297, 32)
      this.devmaj = decNumber(buf, off + 329, 8)
      this.devmin = decNumber(buf, off + 337, 8)
      if (buf[off + 475] !== 0) {
        // definitely a prefix, definitely >130 chars.
        const prefix = decString(buf, off + 345, 155)
        this.path = prefix + '/' + this.path
      } else {
        const prefix = decString(buf, off + 345, 130)
        if (prefix) {
          this.path = prefix + '/' + this.path
        }
        this.atime = decDate(buf, off + 476, 12)
        this.ctime = decDate(buf, off + 488, 12)
      }
    }

    let sum = 8 * 0x20
    for (let i = off; i < off + 148; i++) {
      sum += buf[i]
    }

    for (let i = off + 156; i < off + 512; i++) {
      sum += buf[i]
    }

    this.cksumValid = sum === this.cksum
    if (this.cksum === null && sum === 8 * 0x20) {
      this.nullBlock = true
    }
  }

  [SLURP] (ex, global) {
    for (const k in ex) {
      // we slurp in everything except for the path attribute in
      // a global extended header, because that's weird.
      if (ex[k] !== null && ex[k] !== undefined &&
          !(global && k === 'path')) {
        this[k] = ex[k]
      }
    }
  }

  encode (buf, off) {
    if (!buf) {
      buf = this.block = Buffer.alloc(512)
      off = 0
    }

    if (!off) {
      off = 0
    }

    if (!(buf.length >= off + 512)) {
      throw new Error('need 512 bytes for header')
    }

    const prefixSize = this.ctime || this.atime ? 130 : 155
    const split = splitPrefix(this.path || '', prefixSize)
    const path = split[0]
    const prefix = split[1]
    this.needPax = split[2]

    this.needPax = encString(buf, off, 100, path) || this.needPax
    this.needPax = encNumber(buf, off + 100, 8, this.mode) || this.needPax
    this.needPax = encNumber(buf, off + 108, 8, this.uid) || this.needPax
    this.needPax = encNumber(buf, off + 116, 8, this.gid) || this.needPax
    this.needPax = encNumber(buf, off + 124, 12, this.size) || this.needPax
    this.needPax = encDate(buf, off + 136, 12, this.mtime) || this.needPax
    buf[off + 156] = this[TYPE].charCodeAt(0)
    this.needPax = encString(buf, off + 157, 100, this.linkpath) || this.needPax
    buf.write('ustar\u000000', off + 257, 8)
    this.needPax = encString(buf, off + 265, 32, this.uname) || this.needPax
    this.needPax = encString(buf, off + 297, 32, this.gname) || this.needPax
    this.needPax = encNumber(buf, off + 329, 8, this.devmaj) || this.needPax
    this.needPax = encNumber(buf, off + 337, 8, this.devmin) || this.needPax
    this.needPax = encString(buf, off + 345, prefixSize, prefix) || this.needPax
    if (buf[off + 475] !== 0) {
      this.needPax = encString(buf, off + 345, 155, prefix) || this.needPax
    } else {
      this.needPax = encString(buf, off + 345, 130, prefix) || this.needPax
      this.needPax = encDate(buf, off + 476, 12, this.atime) || this.needPax
      this.needPax = encDate(buf, off + 488, 12, this.ctime) || this.needPax
    }

    let sum = 8 * 0x20
    for (let i = off; i < off + 148; i++) {
      sum += buf[i]
    }

    for (let i = off + 156; i < off + 512; i++) {
      sum += buf[i]
    }

    this.cksum = sum
    encNumber(buf, off + 148, 8, this.cksum)
    this.cksumValid = true

    return this.needPax
  }

  set (data) {
    for (const i in data) {
      if (data[i] !== null && data[i] !== undefined) {
        this[i] = data[i]
      }
    }
  }

  get type () {
    return types.name.get(this[TYPE]) || this[TYPE]
  }

  get typeKey () {
    return this[TYPE]
  }

  set type (type) {
    if (types.code.has(type)) {
      this[TYPE] = types.code.get(type)
    } else {
      this[TYPE] = type
    }
  }
}

const splitPrefix = (p, prefixSize) => {
  const pathSize = 100
  let pp = p
  let prefix = ''
  let ret
  const root = pathModule.parse(p).root || '.'

  if (Buffer.byteLength(pp) < pathSize) {
    ret = [pp, prefix, false]
  } else {
    // first set prefix to the dir, and path to the base
    prefix = pathModule.dirname(pp)
    pp = pathModule.basename(pp)

    do {
      if (Buffer.byteLength(pp) <= pathSize &&
          Buffer.byteLength(prefix) <= prefixSize) {
        // both fit!
        ret = [pp, prefix, false]
      } else if (Buffer.byteLength(pp) > pathSize &&
          Buffer.byteLength(prefix) <= prefixSize) {
        // prefix fits in prefix, but path doesn't fit in path
        ret = [pp.slice(0, pathSize - 1), prefix, true]
      } else {
        // make path take a bit from prefix
        pp = pathModule.join(pathModule.basename(prefix), pp)
        prefix = pathModule.dirname(prefix)
      }
    } while (prefix !== root && !ret)

    // at this point, found no resolution, just truncate
    if (!ret) {
      ret = [p.slice(0, pathSize - 1), '', true]
    }
  }
  return ret
}

const decString = (buf, off, size) =>
  buf.slice(off, off + size).toString('utf8').replace(/\0.*/, '')

const decDate = (buf, off, size) =>
  numToDate(decNumber(buf, off, size))

const numToDate = num => num === null ? null : new Date(num * 1000)

const decNumber = (buf, off, size) =>
  buf[off] & 0x80 ? large.parse(buf.slice(off, off + size))
  : decSmallNumber(buf, off, size)

const nanNull = value => isNaN(value) ? null : value

const decSmallNumber = (buf, off, size) =>
  nanNull(parseInt(
    buf.slice(off, off + size)
      .toString('utf8').replace(/\0.*$/, '').trim(), 8))

// the maximum encodable as a null-terminated octal, by field size
const MAXNUM = {
  12: 0o77777777777,
  8: 0o7777777,
}

const encNumber = (buf, off, size, number) =>
  number === null ? false :
  number > MAXNUM[size] || number < 0
    ? (large.encode(number, buf.slice(off, off + size)), true)
    : (encSmallNumber(buf, off, size, number), false)

const encSmallNumber = (buf, off, size, number) =>
  buf.write(octalString(number, size), off, size, 'ascii')

const octalString = (number, size) =>
  padOctal(Math.floor(number).toString(8), size)

const padOctal = (string, size) =>
  (string.length === size - 1 ? string
  : new Array(size - string.length - 1).join('0') + string + ' ') + '\0'

const encDate = (buf, off, size, date) =>
  date === null ? false :
  encNumber(buf, off, size, date.getTime() / 1000)

// enough to fill the longest string we've got
const NULLS = new Array(156).join('\0')
// pad with nulls, return true if it's longer or non-ascii
const encString = (buf, off, size, string) =>
  string === null ? false :
  (buf.write(string + NULLS, off, size, 'utf8'),
  string.length !== Buffer.byteLength(string) || string.length > size)

module.exports = Header


/***/ }),

/***/ 8052:
/***/ ((module) => {



// turn tar(1) style args like `C` into the more verbose things like `cwd`

const argmap = new Map([
  ['C', 'cwd'],
  ['f', 'file'],
  ['z', 'gzip'],
  ['P', 'preservePaths'],
  ['U', 'unlink'],
  ['strip-components', 'strip'],
  ['stripComponents', 'strip'],
  ['keep-newer', 'newer'],
  ['keepNewer', 'newer'],
  ['keep-newer-files', 'newer'],
  ['keepNewerFiles', 'newer'],
  ['k', 'keep'],
  ['keep-existing', 'keep'],
  ['keepExisting', 'keep'],
  ['m', 'noMtime'],
  ['no-mtime', 'noMtime'],
  ['p', 'preserveOwner'],
  ['L', 'follow'],
  ['h', 'follow'],
])

module.exports = opt => opt ? Object.keys(opt).map(k => [
  argmap.has(k) ? argmap.get(k) : k, opt[k],
]).reduce((set, kv) => (set[kv[0]] = kv[1], set), Object.create(null)) : {}


/***/ }),

/***/ 8156:
/***/ ((module) => {


// Tar can encode large and negative numbers using a leading byte of
// 0xff for negative, and 0x80 for positive.

const encode = (num, buf) => {
  if (!Number.isSafeInteger(num)) {
  // The number is so large that javascript cannot represent it with integer
  // precision.
    throw Error('cannot encode number outside of javascript safe integer range')
  } else if (num < 0) {
    encodeNegative(num, buf)
  } else {
    encodePositive(num, buf)
  }
  return buf
}

const encodePositive = (num, buf) => {
  buf[0] = 0x80

  for (var i = buf.length; i > 1; i--) {
    buf[i - 1] = num & 0xff
    num = Math.floor(num / 0x100)
  }
}

const encodeNegative = (num, buf) => {
  buf[0] = 0xff
  var flipped = false
  num = num * -1
  for (var i = buf.length; i > 1; i--) {
    var byte = num & 0xff
    num = Math.floor(num / 0x100)
    if (flipped) {
      buf[i - 1] = onesComp(byte)
    } else if (byte === 0) {
      buf[i - 1] = 0
    } else {
      flipped = true
      buf[i - 1] = twosComp(byte)
    }
  }
}

const parse = (buf) => {
  const pre = buf[0]
  const value = pre === 0x80 ? pos(buf.slice(1, buf.length))
    : pre === 0xff ? twos(buf)
    : null
  if (value === null) {
    throw Error('invalid base256 encoding')
  }

  if (!Number.isSafeInteger(value)) {
  // The number is so large that javascript cannot represent it with integer
  // precision.
    throw Error('parsed number outside of javascript safe integer range')
  }

  return value
}

const twos = (buf) => {
  var len = buf.length
  var sum = 0
  var flipped = false
  for (var i = len - 1; i > -1; i--) {
    var byte = buf[i]
    var f
    if (flipped) {
      f = onesComp(byte)
    } else if (byte === 0) {
      f = byte
    } else {
      flipped = true
      f = twosComp(byte)
    }
    if (f !== 0) {
      sum -= f * Math.pow(256, len - i - 1)
    }
  }
  return sum
}

const pos = (buf) => {
  var len = buf.length
  var sum = 0
  for (var i = len - 1; i > -1; i--) {
    var byte = buf[i]
    if (byte !== 0) {
      sum += byte * Math.pow(256, len - i - 1)
    }
  }
  return sum
}

const onesComp = byte => (0xff ^ byte) & 0xff

const twosComp = byte => ((0xff ^ byte) + 1) & 0xff

module.exports = {
  encode,
  parse,
}


/***/ }),

/***/ 7991:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// XXX: This shares a lot in common with extract.js
// maybe some DRY opportunity here?

// tar -t
const hlo = __webpack_require__(8052)
const Parser = __webpack_require__(3576)
const fs = __webpack_require__(7147)
const fsm = __webpack_require__(1354)
const path = __webpack_require__(1017)
const stripSlash = __webpack_require__(9812)

module.exports = (opt_, files, cb) => {
  if (typeof opt_ === 'function') {
    cb = opt_, files = null, opt_ = {}
  } else if (Array.isArray(opt_)) {
    files = opt_, opt_ = {}
  }

  if (typeof files === 'function') {
    cb = files, files = null
  }

  if (!files) {
    files = []
  } else {
    files = Array.from(files)
  }

  const opt = hlo(opt_)

  if (opt.sync && typeof cb === 'function') {
    throw new TypeError('callback not supported for sync tar functions')
  }

  if (!opt.file && typeof cb === 'function') {
    throw new TypeError('callback only supported with file option')
  }

  if (files.length) {
    filesFilter(opt, files)
  }

  if (!opt.noResume) {
    onentryFunction(opt)
  }

  return opt.file && opt.sync ? listFileSync(opt)
    : opt.file ? listFile(opt, cb)
    : list(opt)
}

const onentryFunction = opt => {
  const onentry = opt.onentry
  opt.onentry = onentry ? e => {
    onentry(e)
    e.resume()
  } : e => e.resume()
}

// construct a filter that limits the file entries listed
// include child entries if a dir is included
const filesFilter = (opt, files) => {
  const map = new Map(files.map(f => [stripSlash(f), true]))
  const filter = opt.filter

  const mapHas = (file, r) => {
    const root = r || path.parse(file).root || '.'
    const ret = file === root ? false
      : map.has(file) ? map.get(file)
      : mapHas(path.dirname(file), root)

    map.set(file, ret)
    return ret
  }

  opt.filter = filter
    ? (file, entry) => filter(file, entry) && mapHas(stripSlash(file))
    : file => mapHas(stripSlash(file))
}

const listFileSync = opt => {
  const p = list(opt)
  const file = opt.file
  let threw = true
  let fd
  try {
    const stat = fs.statSync(file)
    const readSize = opt.maxReadSize || 16 * 1024 * 1024
    if (stat.size < readSize) {
      p.end(fs.readFileSync(file))
    } else {
      let pos = 0
      const buf = Buffer.allocUnsafe(readSize)
      fd = fs.openSync(file, 'r')
      while (pos < stat.size) {
        const bytesRead = fs.readSync(fd, buf, 0, readSize, pos)
        pos += bytesRead
        p.write(buf.slice(0, bytesRead))
      }
      p.end()
    }
    threw = false
  } finally {
    if (threw && fd) {
      try {
        fs.closeSync(fd)
      } catch (er) {}
    }
  }
}

const listFile = (opt, cb) => {
  const parse = new Parser(opt)
  const readSize = opt.maxReadSize || 16 * 1024 * 1024

  const file = opt.file
  const p = new Promise((resolve, reject) => {
    parse.on('error', reject)
    parse.on('end', resolve)

    fs.stat(file, (er, stat) => {
      if (er) {
        reject(er)
      } else {
        const stream = new fsm.ReadStream(file, {
          readSize: readSize,
          size: stat.size,
        })
        stream.on('error', reject)
        stream.pipe(parse)
      }
    })
  })
  return cb ? p.then(cb, cb) : p
}

const list = opt => new Parser(opt)


/***/ }),

/***/ 7994:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


// wrapper around mkdirp for tar's needs.

// TODO: This should probably be a class, not functionally
// passing around state in a gazillion args.

const mkdirp = __webpack_require__(760)
const fs = __webpack_require__(7147)
const path = __webpack_require__(1017)
const chownr = __webpack_require__(2032)
const normPath = __webpack_require__(8407)

class SymlinkError extends Error {
  constructor (symlink, path) {
    super('Cannot extract through symbolic link')
    this.path = path
    this.symlink = symlink
  }

  get name () {
    return 'SylinkError'
  }
}

class CwdError extends Error {
  constructor (path, code) {
    super(code + ': Cannot cd into \'' + path + '\'')
    this.path = path
    this.code = code
  }

  get name () {
    return 'CwdError'
  }
}

const cGet = (cache, key) => cache.get(normPath(key))
const cSet = (cache, key, val) => cache.set(normPath(key), val)

const checkCwd = (dir, cb) => {
  fs.stat(dir, (er, st) => {
    if (er || !st.isDirectory()) {
      er = new CwdError(dir, er && er.code || 'ENOTDIR')
    }
    cb(er)
  })
}

module.exports = (dir, opt, cb) => {
  dir = normPath(dir)

  // if there's any overlap between mask and mode,
  // then we'll need an explicit chmod
  const umask = opt.umask
  const mode = opt.mode | 0o0700
  const needChmod = (mode & umask) !== 0

  const uid = opt.uid
  const gid = opt.gid
  const doChown = typeof uid === 'number' &&
    typeof gid === 'number' &&
    (uid !== opt.processUid || gid !== opt.processGid)

  const preserve = opt.preserve
  const unlink = opt.unlink
  const cache = opt.cache
  const cwd = normPath(opt.cwd)

  const done = (er, created) => {
    if (er) {
      cb(er)
    } else {
      cSet(cache, dir, true)
      if (created && doChown) {
        chownr(created, uid, gid, er => done(er))
      } else if (needChmod) {
        fs.chmod(dir, mode, cb)
      } else {
        cb()
      }
    }
  }

  if (cache && cGet(cache, dir) === true) {
    return done()
  }

  if (dir === cwd) {
    return checkCwd(dir, done)
  }

  if (preserve) {
    return mkdirp(dir, { mode }).then(made => done(null, made), done)
  }

  const sub = normPath(path.relative(cwd, dir))
  const parts = sub.split('/')
  mkdir_(cwd, parts, mode, cache, unlink, cwd, null, done)
}

const mkdir_ = (base, parts, mode, cache, unlink, cwd, created, cb) => {
  if (!parts.length) {
    return cb(null, created)
  }
  const p = parts.shift()
  const part = normPath(path.resolve(base + '/' + p))
  if (cGet(cache, part)) {
    return mkdir_(part, parts, mode, cache, unlink, cwd, created, cb)
  }
  fs.mkdir(part, mode, onmkdir(part, parts, mode, cache, unlink, cwd, created, cb))
}

const onmkdir = (part, parts, mode, cache, unlink, cwd, created, cb) => er => {
  if (er) {
    fs.lstat(part, (statEr, st) => {
      if (statEr) {
        statEr.path = statEr.path && normPath(statEr.path)
        cb(statEr)
      } else if (st.isDirectory()) {
        mkdir_(part, parts, mode, cache, unlink, cwd, created, cb)
      } else if (unlink) {
        fs.unlink(part, er => {
          if (er) {
            return cb(er)
          }
          fs.mkdir(part, mode, onmkdir(part, parts, mode, cache, unlink, cwd, created, cb))
        })
      } else if (st.isSymbolicLink()) {
        return cb(new SymlinkError(part, part + '/' + parts.join('/')))
      } else {
        cb(er)
      }
    })
  } else {
    created = created || part
    mkdir_(part, parts, mode, cache, unlink, cwd, created, cb)
  }
}

const checkCwdSync = dir => {
  let ok = false
  let code = 'ENOTDIR'
  try {
    ok = fs.statSync(dir).isDirectory()
  } catch (er) {
    code = er.code
  } finally {
    if (!ok) {
      throw new CwdError(dir, code)
    }
  }
}

module.exports.sync = (dir, opt) => {
  dir = normPath(dir)
  // if there's any overlap between mask and mode,
  // then we'll need an explicit chmod
  const umask = opt.umask
  const mode = opt.mode | 0o0700
  const needChmod = (mode & umask) !== 0

  const uid = opt.uid
  const gid = opt.gid
  const doChown = typeof uid === 'number' &&
    typeof gid === 'number' &&
    (uid !== opt.processUid || gid !== opt.processGid)

  const preserve = opt.preserve
  const unlink = opt.unlink
  const cache = opt.cache
  const cwd = normPath(opt.cwd)

  const done = (created) => {
    cSet(cache, dir, true)
    if (created && doChown) {
      chownr.sync(created, uid, gid)
    }
    if (needChmod) {
      fs.chmodSync(dir, mode)
    }
  }

  if (cache && cGet(cache, dir) === true) {
    return done()
  }

  if (dir === cwd) {
    checkCwdSync(cwd)
    return done()
  }

  if (preserve) {
    return done(mkdirp.sync(dir, mode))
  }

  const sub = normPath(path.relative(cwd, dir))
  const parts = sub.split('/')
  let created = null
  for (let p = parts.shift(), part = cwd;
    p && (part += '/' + p);
    p = parts.shift()) {
    part = normPath(path.resolve(part))
    if (cGet(cache, part)) {
      continue
    }

    try {
      fs.mkdirSync(part, mode)
      created = created || part
      cSet(cache, part, true)
    } catch (er) {
      const st = fs.lstatSync(part)
      if (st.isDirectory()) {
        cSet(cache, part, true)
        continue
      } else if (unlink) {
        fs.unlinkSync(part)
        fs.mkdirSync(part, mode)
        created = created || part
        cSet(cache, part, true)
        continue
      } else if (st.isSymbolicLink()) {
        return new SymlinkError(part, part + '/' + parts.join('/'))
      }
    }
  }

  return done(created)
}


/***/ }),

/***/ 8833:
/***/ ((module) => {


module.exports = (mode, isDir, portable) => {
  mode &= 0o7777

  // in portable mode, use the minimum reasonable umask
  // if this system creates files with 0o664 by default
  // (as some linux distros do), then we'll write the
  // archive with 0o644 instead.  Also, don't ever create
  // a file that is not readable/writable by the owner.
  if (portable) {
    mode = (mode | 0o600) & ~0o22
  }

  // if dirs are readable, then they should be listable
  if (isDir) {
    if (mode & 0o400) {
      mode |= 0o100
    }
    if (mode & 0o40) {
      mode |= 0o10
    }
    if (mode & 0o4) {
      mode |= 0o1
    }
  }
  return mode
}


/***/ }),

/***/ 960:
/***/ ((module) => {

// warning: extremely hot code path.
// This has been meticulously optimized for use
// within npm install on large package trees.
// Do not edit without careful benchmarking.
const normalizeCache = Object.create(null)
const { hasOwnProperty } = Object.prototype
module.exports = s => {
  if (!hasOwnProperty.call(normalizeCache, s)) {
    normalizeCache[s] = s.normalize('NFD')
  }
  return normalizeCache[s]
}


/***/ }),

/***/ 8407:
/***/ ((module) => {

// on windows, either \ or / are valid directory separators.
// on unix, \ is a valid character in filenames.
// so, on windows, and only on windows, we replace all \ chars with /,
// so that we can use / as our one and only directory separator char.

const platform = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform
module.exports = platform !== 'win32' ? p => p
  : p => p && p.replace(/\\/g, '/')


/***/ }),

/***/ 5745:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// A readable tar stream creator
// Technically, this is a transform stream that you write paths into,
// and tar format comes out of.
// The `add()` method is like `write()` but returns this,
// and end() return `this` as well, so you can
// do `new Pack(opt).add('files').add('dir').end().pipe(output)
// You could also do something like:
// streamOfPaths().pipe(new Pack()).pipe(new fs.WriteStream('out.tar'))

class PackJob {
  constructor (path, absolute) {
    this.path = path || './'
    this.absolute = absolute
    this.entry = null
    this.stat = null
    this.readdir = null
    this.pending = false
    this.ignore = false
    this.piped = false
  }
}

const { Minipass } = __webpack_require__(8759)
const zlib = __webpack_require__(8925)
const ReadEntry = __webpack_require__(1774)
const WriteEntry = __webpack_require__(6900)
const WriteEntrySync = WriteEntry.Sync
const WriteEntryTar = WriteEntry.Tar
const Yallist = __webpack_require__(1590)
const EOF = Buffer.alloc(1024)
const ONSTAT = Symbol('onStat')
const ENDED = Symbol('ended')
const QUEUE = Symbol('queue')
const CURRENT = Symbol('current')
const PROCESS = Symbol('process')
const PROCESSING = Symbol('processing')
const PROCESSJOB = Symbol('processJob')
const JOBS = Symbol('jobs')
const JOBDONE = Symbol('jobDone')
const ADDFSENTRY = Symbol('addFSEntry')
const ADDTARENTRY = Symbol('addTarEntry')
const STAT = Symbol('stat')
const READDIR = Symbol('readdir')
const ONREADDIR = Symbol('onreaddir')
const PIPE = Symbol('pipe')
const ENTRY = Symbol('entry')
const ENTRYOPT = Symbol('entryOpt')
const WRITEENTRYCLASS = Symbol('writeEntryClass')
const WRITE = Symbol('write')
const ONDRAIN = Symbol('ondrain')

const fs = __webpack_require__(7147)
const path = __webpack_require__(1017)
const warner = __webpack_require__(1634)
const normPath = __webpack_require__(8407)

const Pack = warner(class Pack extends Minipass {
  constructor (opt) {
    super(opt)
    opt = opt || Object.create(null)
    this.opt = opt
    this.file = opt.file || ''
    this.cwd = opt.cwd || process.cwd()
    this.maxReadSize = opt.maxReadSize
    this.preservePaths = !!opt.preservePaths
    this.strict = !!opt.strict
    this.noPax = !!opt.noPax
    this.prefix = normPath(opt.prefix || '')
    this.linkCache = opt.linkCache || new Map()
    this.statCache = opt.statCache || new Map()
    this.readdirCache = opt.readdirCache || new Map()

    this[WRITEENTRYCLASS] = WriteEntry
    if (typeof opt.onwarn === 'function') {
      this.on('warn', opt.onwarn)
    }

    this.portable = !!opt.portable
    this.zip = null
    if (opt.gzip) {
      if (typeof opt.gzip !== 'object') {
        opt.gzip = {}
      }
      if (this.portable) {
        opt.gzip.portable = true
      }
      this.zip = new zlib.Gzip(opt.gzip)
      this.zip.on('data', chunk => super.write(chunk))
      this.zip.on('end', _ => super.end())
      this.zip.on('drain', _ => this[ONDRAIN]())
      this.on('resume', _ => this.zip.resume())
    } else {
      this.on('drain', this[ONDRAIN])
    }

    this.noDirRecurse = !!opt.noDirRecurse
    this.follow = !!opt.follow
    this.noMtime = !!opt.noMtime
    this.mtime = opt.mtime || null

    this.filter = typeof opt.filter === 'function' ? opt.filter : _ => true

    this[QUEUE] = new Yallist()
    this[JOBS] = 0
    this.jobs = +opt.jobs || 4
    this[PROCESSING] = false
    this[ENDED] = false
  }

  [WRITE] (chunk) {
    return super.write(chunk)
  }

  add (path) {
    this.write(path)
    return this
  }

  end (path) {
    if (path) {
      this.write(path)
    }
    this[ENDED] = true
    this[PROCESS]()
    return this
  }

  write (path) {
    if (this[ENDED]) {
      throw new Error('write after end')
    }

    if (path instanceof ReadEntry) {
      this[ADDTARENTRY](path)
    } else {
      this[ADDFSENTRY](path)
    }
    return this.flowing
  }

  [ADDTARENTRY] (p) {
    const absolute = normPath(path.resolve(this.cwd, p.path))
    // in this case, we don't have to wait for the stat
    if (!this.filter(p.path, p)) {
      p.resume()
    } else {
      const job = new PackJob(p.path, absolute, false)
      job.entry = new WriteEntryTar(p, this[ENTRYOPT](job))
      job.entry.on('end', _ => this[JOBDONE](job))
      this[JOBS] += 1
      this[QUEUE].push(job)
    }

    this[PROCESS]()
  }

  [ADDFSENTRY] (p) {
    const absolute = normPath(path.resolve(this.cwd, p))
    this[QUEUE].push(new PackJob(p, absolute))
    this[PROCESS]()
  }

  [STAT] (job) {
    job.pending = true
    this[JOBS] += 1
    const stat = this.follow ? 'stat' : 'lstat'
    fs[stat](job.absolute, (er, stat) => {
      job.pending = false
      this[JOBS] -= 1
      if (er) {
        this.emit('error', er)
      } else {
        this[ONSTAT](job, stat)
      }
    })
  }

  [ONSTAT] (job, stat) {
    this.statCache.set(job.absolute, stat)
    job.stat = stat

    // now we have the stat, we can filter it.
    if (!this.filter(job.path, stat)) {
      job.ignore = true
    }

    this[PROCESS]()
  }

  [READDIR] (job) {
    job.pending = true
    this[JOBS] += 1
    fs.readdir(job.absolute, (er, entries) => {
      job.pending = false
      this[JOBS] -= 1
      if (er) {
        return this.emit('error', er)
      }
      this[ONREADDIR](job, entries)
    })
  }

  [ONREADDIR] (job, entries) {
    this.readdirCache.set(job.absolute, entries)
    job.readdir = entries
    this[PROCESS]()
  }

  [PROCESS] () {
    if (this[PROCESSING]) {
      return
    }

    this[PROCESSING] = true
    for (let w = this[QUEUE].head;
      w !== null && this[JOBS] < this.jobs;
      w = w.next) {
      this[PROCESSJOB](w.value)
      if (w.value.ignore) {
        const p = w.next
        this[QUEUE].removeNode(w)
        w.next = p
      }
    }

    this[PROCESSING] = false

    if (this[ENDED] && !this[QUEUE].length && this[JOBS] === 0) {
      if (this.zip) {
        this.zip.end(EOF)
      } else {
        super.write(EOF)
        super.end()
      }
    }
  }

  get [CURRENT] () {
    return this[QUEUE] && this[QUEUE].head && this[QUEUE].head.value
  }

  [JOBDONE] (job) {
    this[QUEUE].shift()
    this[JOBS] -= 1
    this[PROCESS]()
  }

  [PROCESSJOB] (job) {
    if (job.pending) {
      return
    }

    if (job.entry) {
      if (job === this[CURRENT] && !job.piped) {
        this[PIPE](job)
      }
      return
    }

    if (!job.stat) {
      if (this.statCache.has(job.absolute)) {
        this[ONSTAT](job, this.statCache.get(job.absolute))
      } else {
        this[STAT](job)
      }
    }
    if (!job.stat) {
      return
    }

    // filtered out!
    if (job.ignore) {
      return
    }

    if (!this.noDirRecurse && job.stat.isDirectory() && !job.readdir) {
      if (this.readdirCache.has(job.absolute)) {
        this[ONREADDIR](job, this.readdirCache.get(job.absolute))
      } else {
        this[READDIR](job)
      }
      if (!job.readdir) {
        return
      }
    }

    // we know it doesn't have an entry, because that got checked above
    job.entry = this[ENTRY](job)
    if (!job.entry) {
      job.ignore = true
      return
    }

    if (job === this[CURRENT] && !job.piped) {
      this[PIPE](job)
    }
  }

  [ENTRYOPT] (job) {
    return {
      onwarn: (code, msg, data) => this.warn(code, msg, data),
      noPax: this.noPax,
      cwd: this.cwd,
      absolute: job.absolute,
      preservePaths: this.preservePaths,
      maxReadSize: this.maxReadSize,
      strict: this.strict,
      portable: this.portable,
      linkCache: this.linkCache,
      statCache: this.statCache,
      noMtime: this.noMtime,
      mtime: this.mtime,
      prefix: this.prefix,
    }
  }

  [ENTRY] (job) {
    this[JOBS] += 1
    try {
      return new this[WRITEENTRYCLASS](job.path, this[ENTRYOPT](job))
        .on('end', () => this[JOBDONE](job))
        .on('error', er => this.emit('error', er))
    } catch (er) {
      this.emit('error', er)
    }
  }

  [ONDRAIN] () {
    if (this[CURRENT] && this[CURRENT].entry) {
      this[CURRENT].entry.resume()
    }
  }

  // like .pipe() but using super, because our write() is special
  [PIPE] (job) {
    job.piped = true

    if (job.readdir) {
      job.readdir.forEach(entry => {
        const p = job.path
        const base = p === './' ? '' : p.replace(/\/*$/, '/')
        this[ADDFSENTRY](base + entry)
      })
    }

    const source = job.entry
    const zip = this.zip

    if (zip) {
      source.on('data', chunk => {
        if (!zip.write(chunk)) {
          source.pause()
        }
      })
    } else {
      source.on('data', chunk => {
        if (!super.write(chunk)) {
          source.pause()
        }
      })
    }
  }

  pause () {
    if (this.zip) {
      this.zip.pause()
    }
    return super.pause()
  }
})

class PackSync extends Pack {
  constructor (opt) {
    super(opt)
    this[WRITEENTRYCLASS] = WriteEntrySync
  }

  // pause/resume are no-ops in sync streams.
  pause () {}
  resume () {}

  [STAT] (job) {
    const stat = this.follow ? 'statSync' : 'lstatSync'
    this[ONSTAT](job, fs[stat](job.absolute))
  }

  [READDIR] (job, stat) {
    this[ONREADDIR](job, fs.readdirSync(job.absolute))
  }

  // gotta get it all in this tick
  [PIPE] (job) {
    const source = job.entry
    const zip = this.zip

    if (job.readdir) {
      job.readdir.forEach(entry => {
        const p = job.path
        const base = p === './' ? '' : p.replace(/\/*$/, '/')
        this[ADDFSENTRY](base + entry)
      })
    }

    if (zip) {
      source.on('data', chunk => {
        zip.write(chunk)
      })
    } else {
      source.on('data', chunk => {
        super[WRITE](chunk)
      })
    }
  }
}

Pack.Sync = PackSync

module.exports = Pack


/***/ }),

/***/ 3576:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// this[BUFFER] is the remainder of a chunk if we're waiting for
// the full 512 bytes of a header to come in.  We will Buffer.concat()
// it to the next write(), which is a mem copy, but a small one.
//
// this[QUEUE] is a Yallist of entries that haven't been emitted
// yet this can only get filled up if the user keeps write()ing after
// a write() returns false, or does a write() with more than one entry
//
// We don't buffer chunks, we always parse them and either create an
// entry, or push it into the active entry.  The ReadEntry class knows
// to throw data away if .ignore=true
//
// Shift entry off the buffer when it emits 'end', and emit 'entry' for
// the next one in the list.
//
// At any time, we're pushing body chunks into the entry at WRITEENTRY,
// and waiting for 'end' on the entry at READENTRY
//
// ignored entries get .resume() called on them straight away

const warner = __webpack_require__(1634)
const Header = __webpack_require__(9868)
const EE = __webpack_require__(2361)
const Yallist = __webpack_require__(1590)
const maxMetaEntrySize = 1024 * 1024
const Entry = __webpack_require__(1774)
const Pax = __webpack_require__(476)
const zlib = __webpack_require__(8925)
const { nextTick } = __webpack_require__(7282)

const gzipHeader = Buffer.from([0x1f, 0x8b])
const STATE = Symbol('state')
const WRITEENTRY = Symbol('writeEntry')
const READENTRY = Symbol('readEntry')
const NEXTENTRY = Symbol('nextEntry')
const PROCESSENTRY = Symbol('processEntry')
const EX = Symbol('extendedHeader')
const GEX = Symbol('globalExtendedHeader')
const META = Symbol('meta')
const EMITMETA = Symbol('emitMeta')
const BUFFER = Symbol('buffer')
const QUEUE = Symbol('queue')
const ENDED = Symbol('ended')
const EMITTEDEND = Symbol('emittedEnd')
const EMIT = Symbol('emit')
const UNZIP = Symbol('unzip')
const CONSUMECHUNK = Symbol('consumeChunk')
const CONSUMECHUNKSUB = Symbol('consumeChunkSub')
const CONSUMEBODY = Symbol('consumeBody')
const CONSUMEMETA = Symbol('consumeMeta')
const CONSUMEHEADER = Symbol('consumeHeader')
const CONSUMING = Symbol('consuming')
const BUFFERCONCAT = Symbol('bufferConcat')
const MAYBEEND = Symbol('maybeEnd')
const WRITING = Symbol('writing')
const ABORTED = Symbol('aborted')
const DONE = Symbol('onDone')
const SAW_VALID_ENTRY = Symbol('sawValidEntry')
const SAW_NULL_BLOCK = Symbol('sawNullBlock')
const SAW_EOF = Symbol('sawEOF')
const CLOSESTREAM = Symbol('closeStream')

const noop = _ => true

module.exports = warner(class Parser extends EE {
  constructor (opt) {
    opt = opt || {}
    super(opt)

    this.file = opt.file || ''

    // set to boolean false when an entry starts.  1024 bytes of \0
    // is technically a valid tarball, albeit a boring one.
    this[SAW_VALID_ENTRY] = null

    // these BADARCHIVE errors can't be detected early. listen on DONE.
    this.on(DONE, _ => {
      if (this[STATE] === 'begin' || this[SAW_VALID_ENTRY] === false) {
        // either less than 1 block of data, or all entries were invalid.
        // Either way, probably not even a tarball.
        this.warn('TAR_BAD_ARCHIVE', 'Unrecognized archive format')
      }
    })

    if (opt.ondone) {
      this.on(DONE, opt.ondone)
    } else {
      this.on(DONE, _ => {
        this.emit('prefinish')
        this.emit('finish')
        this.emit('end')
      })
    }

    this.strict = !!opt.strict
    this.maxMetaEntrySize = opt.maxMetaEntrySize || maxMetaEntrySize
    this.filter = typeof opt.filter === 'function' ? opt.filter : noop

    // have to set this so that streams are ok piping into it
    this.writable = true
    this.readable = false

    this[QUEUE] = new Yallist()
    this[BUFFER] = null
    this[READENTRY] = null
    this[WRITEENTRY] = null
    this[STATE] = 'begin'
    this[META] = ''
    this[EX] = null
    this[GEX] = null
    this[ENDED] = false
    this[UNZIP] = null
    this[ABORTED] = false
    this[SAW_NULL_BLOCK] = false
    this[SAW_EOF] = false

    this.on('end', () => this[CLOSESTREAM]())

    if (typeof opt.onwarn === 'function') {
      this.on('warn', opt.onwarn)
    }
    if (typeof opt.onentry === 'function') {
      this.on('entry', opt.onentry)
    }
  }

  [CONSUMEHEADER] (chunk, position) {
    if (this[SAW_VALID_ENTRY] === null) {
      this[SAW_VALID_ENTRY] = false
    }
    let header
    try {
      header = new Header(chunk, position, this[EX], this[GEX])
    } catch (er) {
      return this.warn('TAR_ENTRY_INVALID', er)
    }

    if (header.nullBlock) {
      if (this[SAW_NULL_BLOCK]) {
        this[SAW_EOF] = true
        // ending an archive with no entries.  pointless, but legal.
        if (this[STATE] === 'begin') {
          this[STATE] = 'header'
        }
        this[EMIT]('eof')
      } else {
        this[SAW_NULL_BLOCK] = true
        this[EMIT]('nullBlock')
      }
    } else {
      this[SAW_NULL_BLOCK] = false
      if (!header.cksumValid) {
        this.warn('TAR_ENTRY_INVALID', 'checksum failure', { header })
      } else if (!header.path) {
        this.warn('TAR_ENTRY_INVALID', 'path is required', { header })
      } else {
        const type = header.type
        if (/^(Symbolic)?Link$/.test(type) && !header.linkpath) {
          this.warn('TAR_ENTRY_INVALID', 'linkpath required', { header })
        } else if (!/^(Symbolic)?Link$/.test(type) && header.linkpath) {
          this.warn('TAR_ENTRY_INVALID', 'linkpath forbidden', { header })
        } else {
          const entry = this[WRITEENTRY] = new Entry(header, this[EX], this[GEX])

          // we do this for meta & ignored entries as well, because they
          // are still valid tar, or else we wouldn't know to ignore them
          if (!this[SAW_VALID_ENTRY]) {
            if (entry.remain) {
              // this might be the one!
              const onend = () => {
                if (!entry.invalid) {
                  this[SAW_VALID_ENTRY] = true
                }
              }
              entry.on('end', onend)
            } else {
              this[SAW_VALID_ENTRY] = true
            }
          }

          if (entry.meta) {
            if (entry.size > this.maxMetaEntrySize) {
              entry.ignore = true
              this[EMIT]('ignoredEntry', entry)
              this[STATE] = 'ignore'
              entry.resume()
            } else if (entry.size > 0) {
              this[META] = ''
              entry.on('data', c => this[META] += c)
              this[STATE] = 'meta'
            }
          } else {
            this[EX] = null
            entry.ignore = entry.ignore || !this.filter(entry.path, entry)

            if (entry.ignore) {
              // probably valid, just not something we care about
              this[EMIT]('ignoredEntry', entry)
              this[STATE] = entry.remain ? 'ignore' : 'header'
              entry.resume()
            } else {
              if (entry.remain) {
                this[STATE] = 'body'
              } else {
                this[STATE] = 'header'
                entry.end()
              }

              if (!this[READENTRY]) {
                this[QUEUE].push(entry)
                this[NEXTENTRY]()
              } else {
                this[QUEUE].push(entry)
              }
            }
          }
        }
      }
    }
  }

  [CLOSESTREAM] () {
    nextTick(() => this.emit('close'))
  }

  [PROCESSENTRY] (entry) {
    let go = true

    if (!entry) {
      this[READENTRY] = null
      go = false
    } else if (Array.isArray(entry)) {
      this.emit.apply(this, entry)
    } else {
      this[READENTRY] = entry
      this.emit('entry', entry)
      if (!entry.emittedEnd) {
        entry.on('end', _ => this[NEXTENTRY]())
        go = false
      }
    }

    return go
  }

  [NEXTENTRY] () {
    do {} while (this[PROCESSENTRY](this[QUEUE].shift()))

    if (!this[QUEUE].length) {
      // At this point, there's nothing in the queue, but we may have an
      // entry which is being consumed (readEntry).
      // If we don't, then we definitely can handle more data.
      // If we do, and either it's flowing, or it has never had any data
      // written to it, then it needs more.
      // The only other possibility is that it has returned false from a
      // write() call, so we wait for the next drain to continue.
      const re = this[READENTRY]
      const drainNow = !re || re.flowing || re.size === re.remain
      if (drainNow) {
        if (!this[WRITING]) {
          this.emit('drain')
        }
      } else {
        re.once('drain', _ => this.emit('drain'))
      }
    }
  }

  [CONSUMEBODY] (chunk, position) {
    // write up to but no  more than writeEntry.blockRemain
    const entry = this[WRITEENTRY]
    const br = entry.blockRemain
    const c = (br >= chunk.length && position === 0) ? chunk
      : chunk.slice(position, position + br)

    entry.write(c)

    if (!entry.blockRemain) {
      this[STATE] = 'header'
      this[WRITEENTRY] = null
      entry.end()
    }

    return c.length
  }

  [CONSUMEMETA] (chunk, position) {
    const entry = this[WRITEENTRY]
    const ret = this[CONSUMEBODY](chunk, position)

    // if we finished, then the entry is reset
    if (!this[WRITEENTRY]) {
      this[EMITMETA](entry)
    }

    return ret
  }

  [EMIT] (ev, data, extra) {
    if (!this[QUEUE].length && !this[READENTRY]) {
      this.emit(ev, data, extra)
    } else {
      this[QUEUE].push([ev, data, extra])
    }
  }

  [EMITMETA] (entry) {
    this[EMIT]('meta', this[META])
    switch (entry.type) {
      case 'ExtendedHeader':
      case 'OldExtendedHeader':
        this[EX] = Pax.parse(this[META], this[EX], false)
        break

      case 'GlobalExtendedHeader':
        this[GEX] = Pax.parse(this[META], this[GEX], true)
        break

      case 'NextFileHasLongPath':
      case 'OldGnuLongPath':
        this[EX] = this[EX] || Object.create(null)
        this[EX].path = this[META].replace(/\0.*/, '')
        break

      case 'NextFileHasLongLinkpath':
        this[EX] = this[EX] || Object.create(null)
        this[EX].linkpath = this[META].replace(/\0.*/, '')
        break

      /* istanbul ignore next */
      default: throw new Error('unknown meta: ' + entry.type)
    }
  }

  abort (error) {
    this[ABORTED] = true
    this.emit('abort', error)
    // always throws, even in non-strict mode
    this.warn('TAR_ABORT', error, { recoverable: false })
  }

  write (chunk) {
    if (this[ABORTED]) {
      return
    }

    // first write, might be gzipped
    if (this[UNZIP] === null && chunk) {
      if (this[BUFFER]) {
        chunk = Buffer.concat([this[BUFFER], chunk])
        this[BUFFER] = null
      }
      if (chunk.length < gzipHeader.length) {
        this[BUFFER] = chunk
        return true
      }
      for (let i = 0; this[UNZIP] === null && i < gzipHeader.length; i++) {
        if (chunk[i] !== gzipHeader[i]) {
          this[UNZIP] = false
        }
      }
      if (this[UNZIP] === null) {
        const ended = this[ENDED]
        this[ENDED] = false
        this[UNZIP] = new zlib.Unzip()
        this[UNZIP].on('data', chunk => this[CONSUMECHUNK](chunk))
        this[UNZIP].on('error', er => this.abort(er))
        this[UNZIP].on('end', _ => {
          this[ENDED] = true
          this[CONSUMECHUNK]()
        })
        this[WRITING] = true
        const ret = this[UNZIP][ended ? 'end' : 'write'](chunk)
        this[WRITING] = false
        return ret
      }
    }

    this[WRITING] = true
    if (this[UNZIP]) {
      this[UNZIP].write(chunk)
    } else {
      this[CONSUMECHUNK](chunk)
    }
    this[WRITING] = false

    // return false if there's a queue, or if the current entry isn't flowing
    const ret =
      this[QUEUE].length ? false :
      this[READENTRY] ? this[READENTRY].flowing :
      true

    // if we have no queue, then that means a clogged READENTRY
    if (!ret && !this[QUEUE].length) {
      this[READENTRY].once('drain', _ => this.emit('drain'))
    }

    return ret
  }

  [BUFFERCONCAT] (c) {
    if (c && !this[ABORTED]) {
      this[BUFFER] = this[BUFFER] ? Buffer.concat([this[BUFFER], c]) : c
    }
  }

  [MAYBEEND] () {
    if (this[ENDED] &&
        !this[EMITTEDEND] &&
        !this[ABORTED] &&
        !this[CONSUMING]) {
      this[EMITTEDEND] = true
      const entry = this[WRITEENTRY]
      if (entry && entry.blockRemain) {
        // truncated, likely a damaged file
        const have = this[BUFFER] ? this[BUFFER].length : 0
        this.warn('TAR_BAD_ARCHIVE', `Truncated input (needed ${
          entry.blockRemain} more bytes, only ${have} available)`, { entry })
        if (this[BUFFER]) {
          entry.write(this[BUFFER])
        }
        entry.end()
      }
      this[EMIT](DONE)
    }
  }

  [CONSUMECHUNK] (chunk) {
    if (this[CONSUMING]) {
      this[BUFFERCONCAT](chunk)
    } else if (!chunk && !this[BUFFER]) {
      this[MAYBEEND]()
    } else {
      this[CONSUMING] = true
      if (this[BUFFER]) {
        this[BUFFERCONCAT](chunk)
        const c = this[BUFFER]
        this[BUFFER] = null
        this[CONSUMECHUNKSUB](c)
      } else {
        this[CONSUMECHUNKSUB](chunk)
      }

      while (this[BUFFER] &&
          this[BUFFER].length >= 512 &&
          !this[ABORTED] &&
          !this[SAW_EOF]) {
        const c = this[BUFFER]
        this[BUFFER] = null
        this[CONSUMECHUNKSUB](c)
      }
      this[CONSUMING] = false
    }

    if (!this[BUFFER] || this[ENDED]) {
      this[MAYBEEND]()
    }
  }

  [CONSUMECHUNKSUB] (chunk) {
    // we know that we are in CONSUMING mode, so anything written goes into
    // the buffer.  Advance the position and put any remainder in the buffer.
    let position = 0
    const length = chunk.length
    while (position + 512 <= length && !this[ABORTED] && !this[SAW_EOF]) {
      switch (this[STATE]) {
        case 'begin':
        case 'header':
          this[CONSUMEHEADER](chunk, position)
          position += 512
          break

        case 'ignore':
        case 'body':
          position += this[CONSUMEBODY](chunk, position)
          break

        case 'meta':
          position += this[CONSUMEMETA](chunk, position)
          break

        /* istanbul ignore next */
        default:
          throw new Error('invalid state: ' + this[STATE])
      }
    }

    if (position < length) {
      if (this[BUFFER]) {
        this[BUFFER] = Buffer.concat([chunk.slice(position), this[BUFFER]])
      } else {
        this[BUFFER] = chunk.slice(position)
      }
    }
  }

  end (chunk) {
    if (!this[ABORTED]) {
      if (this[UNZIP]) {
        this[UNZIP].end(chunk)
      } else {
        this[ENDED] = true
        this.write(chunk)
      }
    }
  }
})


/***/ }),

/***/ 3712:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// A path exclusive reservation system
// reserve([list, of, paths], fn)
// When the fn is first in line for all its paths, it
// is called with a cb that clears the reservation.
//
// Used by async unpack to avoid clobbering paths in use,
// while still allowing maximal safe parallelization.

const assert = __webpack_require__(9491)
const normalize = __webpack_require__(960)
const stripSlashes = __webpack_require__(9812)
const { join } = __webpack_require__(1017)

const platform = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform
const isWindows = platform === 'win32'

module.exports = () => {
  // path => [function or Set]
  // A Set object means a directory reservation
  // A fn is a direct reservation on that path
  const queues = new Map()

  // fn => {paths:[path,...], dirs:[path, ...]}
  const reservations = new Map()

  // return a set of parent dirs for a given path
  // '/a/b/c/d' -> ['/', '/a', '/a/b', '/a/b/c', '/a/b/c/d']
  const getDirs = path => {
    const dirs = path.split('/').slice(0, -1).reduce((set, path) => {
      if (set.length) {
        path = join(set[set.length - 1], path)
      }
      set.push(path || '/')
      return set
    }, [])
    return dirs
  }

  // functions currently running
  const running = new Set()

  // return the queues for each path the function cares about
  // fn => {paths, dirs}
  const getQueues = fn => {
    const res = reservations.get(fn)
    /* istanbul ignore if - unpossible */
    if (!res) {
      throw new Error('function does not have any path reservations')
    }
    return {
      paths: res.paths.map(path => queues.get(path)),
      dirs: [...res.dirs].map(path => queues.get(path)),
    }
  }

  // check if fn is first in line for all its paths, and is
  // included in the first set for all its dir queues
  const check = fn => {
    const { paths, dirs } = getQueues(fn)
    return paths.every(q => q[0] === fn) &&
      dirs.every(q => q[0] instanceof Set && q[0].has(fn))
  }

  // run the function if it's first in line and not already running
  const run = fn => {
    if (running.has(fn) || !check(fn)) {
      return false
    }
    running.add(fn)
    fn(() => clear(fn))
    return true
  }

  const clear = fn => {
    if (!running.has(fn)) {
      return false
    }

    const { paths, dirs } = reservations.get(fn)
    const next = new Set()

    paths.forEach(path => {
      const q = queues.get(path)
      assert.equal(q[0], fn)
      if (q.length === 1) {
        queues.delete(path)
      } else {
        q.shift()
        if (typeof q[0] === 'function') {
          next.add(q[0])
        } else {
          q[0].forEach(fn => next.add(fn))
        }
      }
    })

    dirs.forEach(dir => {
      const q = queues.get(dir)
      assert(q[0] instanceof Set)
      if (q[0].size === 1 && q.length === 1) {
        queues.delete(dir)
      } else if (q[0].size === 1) {
        q.shift()

        // must be a function or else the Set would've been reused
        next.add(q[0])
      } else {
        q[0].delete(fn)
      }
    })
    running.delete(fn)

    next.forEach(fn => run(fn))
    return true
  }

  const reserve = (paths, fn) => {
    // collide on matches across case and unicode normalization
    // On windows, thanks to the magic of 8.3 shortnames, it is fundamentally
    // impossible to determine whether two paths refer to the same thing on
    // disk, without asking the kernel for a shortname.
    // So, we just pretend that every path matches every other path here,
    // effectively removing all parallelization on windows.
    paths = isWindows ? ['win32 parallelization disabled'] : paths.map(p => {
      // don't need normPath, because we skip this entirely for windows
      return stripSlashes(join(normalize(p))).toLowerCase()
    })

    const dirs = new Set(
      paths.map(path => getDirs(path)).reduce((a, b) => a.concat(b))
    )
    reservations.set(fn, { dirs, paths })
    paths.forEach(path => {
      const q = queues.get(path)
      if (!q) {
        queues.set(path, [fn])
      } else {
        q.push(fn)
      }
    })
    dirs.forEach(dir => {
      const q = queues.get(dir)
      if (!q) {
        queues.set(dir, [new Set([fn])])
      } else if (q[q.length - 1] instanceof Set) {
        q[q.length - 1].add(fn)
      } else {
        q.push(new Set([fn]))
      }
    })

    return run(fn)
  }

  return { check, reserve }
}


/***/ }),

/***/ 476:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const Header = __webpack_require__(9868)
const path = __webpack_require__(1017)

class Pax {
  constructor (obj, global) {
    this.atime = obj.atime || null
    this.charset = obj.charset || null
    this.comment = obj.comment || null
    this.ctime = obj.ctime || null
    this.gid = obj.gid || null
    this.gname = obj.gname || null
    this.linkpath = obj.linkpath || null
    this.mtime = obj.mtime || null
    this.path = obj.path || null
    this.size = obj.size || null
    this.uid = obj.uid || null
    this.uname = obj.uname || null
    this.dev = obj.dev || null
    this.ino = obj.ino || null
    this.nlink = obj.nlink || null
    this.global = global || false
  }

  encode () {
    const body = this.encodeBody()
    if (body === '') {
      return null
    }

    const bodyLen = Buffer.byteLength(body)
    // round up to 512 bytes
    // add 512 for header
    const bufLen = 512 * Math.ceil(1 + bodyLen / 512)
    const buf = Buffer.allocUnsafe(bufLen)

    // 0-fill the header section, it might not hit every field
    for (let i = 0; i < 512; i++) {
      buf[i] = 0
    }

    new Header({
      // XXX split the path
      // then the path should be PaxHeader + basename, but less than 99,
      // prepend with the dirname
      path: ('PaxHeader/' + path.basename(this.path)).slice(0, 99),
      mode: this.mode || 0o644,
      uid: this.uid || null,
      gid: this.gid || null,
      size: bodyLen,
      mtime: this.mtime || null,
      type: this.global ? 'GlobalExtendedHeader' : 'ExtendedHeader',
      linkpath: '',
      uname: this.uname || '',
      gname: this.gname || '',
      devmaj: 0,
      devmin: 0,
      atime: this.atime || null,
      ctime: this.ctime || null,
    }).encode(buf)

    buf.write(body, 512, bodyLen, 'utf8')

    // null pad after the body
    for (let i = bodyLen + 512; i < buf.length; i++) {
      buf[i] = 0
    }

    return buf
  }

  encodeBody () {
    return (
      this.encodeField('path') +
      this.encodeField('ctime') +
      this.encodeField('atime') +
      this.encodeField('dev') +
      this.encodeField('ino') +
      this.encodeField('nlink') +
      this.encodeField('charset') +
      this.encodeField('comment') +
      this.encodeField('gid') +
      this.encodeField('gname') +
      this.encodeField('linkpath') +
      this.encodeField('mtime') +
      this.encodeField('size') +
      this.encodeField('uid') +
      this.encodeField('uname')
    )
  }

  encodeField (field) {
    if (this[field] === null || this[field] === undefined) {
      return ''
    }
    const v = this[field] instanceof Date ? this[field].getTime() / 1000
      : this[field]
    const s = ' ' +
      (field === 'dev' || field === 'ino' || field === 'nlink'
        ? 'SCHILY.' : '') +
      field + '=' + v + '\n'
    const byteLen = Buffer.byteLength(s)
    // the digits includes the length of the digits in ascii base-10
    // so if it's 9 characters, then adding 1 for the 9 makes it 10
    // which makes it 11 chars.
    let digits = Math.floor(Math.log(byteLen) / Math.log(10)) + 1
    if (byteLen + digits >= Math.pow(10, digits)) {
      digits += 1
    }
    const len = digits + byteLen
    return len + s
  }
}

Pax.parse = (string, ex, g) => new Pax(merge(parseKV(string), ex), g)

const merge = (a, b) =>
  b ? Object.keys(a).reduce((s, k) => (s[k] = a[k], s), b) : a

const parseKV = string =>
  string
    .replace(/\n$/, '')
    .split('\n')
    .reduce(parseKVLine, Object.create(null))

const parseKVLine = (set, line) => {
  const n = parseInt(line, 10)

  // XXX Values with \n in them will fail this.
  // Refactor to not be a naive line-by-line parse.
  if (n !== Buffer.byteLength(line) + 1) {
    return set
  }

  line = line.slice((n + ' ').length)
  const kv = line.split('=')
  const k = kv.shift().replace(/^SCHILY\.(dev|ino|nlink)/, '$1')
  if (!k) {
    return set
  }

  const v = kv.join('=')
  set[k] = /^([A-Z]+\.)?([mac]|birth|creation)time$/.test(k)
    ? new Date(v * 1000)
    : /^[0-9]+$/.test(v) ? +v
    : v
  return set
}

module.exports = Pax


/***/ }),

/***/ 1774:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const { Minipass } = __webpack_require__(8759)
const normPath = __webpack_require__(8407)

const SLURP = Symbol('slurp')
module.exports = class ReadEntry extends Minipass {
  constructor (header, ex, gex) {
    super()
    // read entries always start life paused.  this is to avoid the
    // situation where Minipass's auto-ending empty streams results
    // in an entry ending before we're ready for it.
    this.pause()
    this.extended = ex
    this.globalExtended = gex
    this.header = header
    this.startBlockSize = 512 * Math.ceil(header.size / 512)
    this.blockRemain = this.startBlockSize
    this.remain = header.size
    this.type = header.type
    this.meta = false
    this.ignore = false
    switch (this.type) {
      case 'File':
      case 'OldFile':
      case 'Link':
      case 'SymbolicLink':
      case 'CharacterDevice':
      case 'BlockDevice':
      case 'Directory':
      case 'FIFO':
      case 'ContiguousFile':
      case 'GNUDumpDir':
        break

      case 'NextFileHasLongLinkpath':
      case 'NextFileHasLongPath':
      case 'OldGnuLongPath':
      case 'GlobalExtendedHeader':
      case 'ExtendedHeader':
      case 'OldExtendedHeader':
        this.meta = true
        break

      // NOTE: gnutar and bsdtar treat unrecognized types as 'File'
      // it may be worth doing the same, but with a warning.
      default:
        this.ignore = true
    }

    this.path = normPath(header.path)
    this.mode = header.mode
    if (this.mode) {
      this.mode = this.mode & 0o7777
    }
    this.uid = header.uid
    this.gid = header.gid
    this.uname = header.uname
    this.gname = header.gname
    this.size = header.size
    this.mtime = header.mtime
    this.atime = header.atime
    this.ctime = header.ctime
    this.linkpath = normPath(header.linkpath)
    this.uname = header.uname
    this.gname = header.gname

    if (ex) {
      this[SLURP](ex)
    }
    if (gex) {
      this[SLURP](gex, true)
    }
  }

  write (data) {
    const writeLen = data.length
    if (writeLen > this.blockRemain) {
      throw new Error('writing more to entry than is appropriate')
    }

    const r = this.remain
    const br = this.blockRemain
    this.remain = Math.max(0, r - writeLen)
    this.blockRemain = Math.max(0, br - writeLen)
    if (this.ignore) {
      return true
    }

    if (r >= writeLen) {
      return super.write(data)
    }

    // r < writeLen
    return super.write(data.slice(0, r))
  }

  [SLURP] (ex, global) {
    for (const k in ex) {
      // we slurp in everything except for the path attribute in
      // a global extended header, because that's weird.
      if (ex[k] !== null && ex[k] !== undefined &&
          !(global && k === 'path')) {
        this[k] = k === 'path' || k === 'linkpath' ? normPath(ex[k]) : ex[k]
      }
    }
  }
}


/***/ }),

/***/ 6562:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// tar -r
const hlo = __webpack_require__(8052)
const Pack = __webpack_require__(5745)
const fs = __webpack_require__(7147)
const fsm = __webpack_require__(1354)
const t = __webpack_require__(7991)
const path = __webpack_require__(1017)

// starting at the head of the file, read a Header
// If the checksum is invalid, that's our position to start writing
// If it is, jump forward by the specified size (round up to 512)
// and try again.
// Write the new Pack stream starting there.

const Header = __webpack_require__(9868)

module.exports = (opt_, files, cb) => {
  const opt = hlo(opt_)

  if (!opt.file) {
    throw new TypeError('file is required')
  }

  if (opt.gzip) {
    throw new TypeError('cannot append to compressed archives')
  }

  if (!files || !Array.isArray(files) || !files.length) {
    throw new TypeError('no files or directories specified')
  }

  files = Array.from(files)

  return opt.sync ? replaceSync(opt, files)
    : replace(opt, files, cb)
}

const replaceSync = (opt, files) => {
  const p = new Pack.Sync(opt)

  let threw = true
  let fd
  let position

  try {
    try {
      fd = fs.openSync(opt.file, 'r+')
    } catch (er) {
      if (er.code === 'ENOENT') {
        fd = fs.openSync(opt.file, 'w+')
      } else {
        throw er
      }
    }

    const st = fs.fstatSync(fd)
    const headBuf = Buffer.alloc(512)

    POSITION: for (position = 0; position < st.size; position += 512) {
      for (let bufPos = 0, bytes = 0; bufPos < 512; bufPos += bytes) {
        bytes = fs.readSync(
          fd, headBuf, bufPos, headBuf.length - bufPos, position + bufPos
        )

        if (position === 0 && headBuf[0] === 0x1f && headBuf[1] === 0x8b) {
          throw new Error('cannot append to compressed archives')
        }

        if (!bytes) {
          break POSITION
        }
      }

      const h = new Header(headBuf)
      if (!h.cksumValid) {
        break
      }
      const entryBlockSize = 512 * Math.ceil(h.size / 512)
      if (position + entryBlockSize + 512 > st.size) {
        break
      }
      // the 512 for the header we just parsed will be added as well
      // also jump ahead all the blocks for the body
      position += entryBlockSize
      if (opt.mtimeCache) {
        opt.mtimeCache.set(h.path, h.mtime)
      }
    }
    threw = false

    streamSync(opt, p, position, fd, files)
  } finally {
    if (threw) {
      try {
        fs.closeSync(fd)
      } catch (er) {}
    }
  }
}

const streamSync = (opt, p, position, fd, files) => {
  const stream = new fsm.WriteStreamSync(opt.file, {
    fd: fd,
    start: position,
  })
  p.pipe(stream)
  addFilesSync(p, files)
}

const replace = (opt, files, cb) => {
  files = Array.from(files)
  const p = new Pack(opt)

  const getPos = (fd, size, cb_) => {
    const cb = (er, pos) => {
      if (er) {
        fs.close(fd, _ => cb_(er))
      } else {
        cb_(null, pos)
      }
    }

    let position = 0
    if (size === 0) {
      return cb(null, 0)
    }

    let bufPos = 0
    const headBuf = Buffer.alloc(512)
    const onread = (er, bytes) => {
      if (er) {
        return cb(er)
      }
      bufPos += bytes
      if (bufPos < 512 && bytes) {
        return fs.read(
          fd, headBuf, bufPos, headBuf.length - bufPos,
          position + bufPos, onread
        )
      }

      if (position === 0 && headBuf[0] === 0x1f && headBuf[1] === 0x8b) {
        return cb(new Error('cannot append to compressed archives'))
      }

      // truncated header
      if (bufPos < 512) {
        return cb(null, position)
      }

      const h = new Header(headBuf)
      if (!h.cksumValid) {
        return cb(null, position)
      }

      const entryBlockSize = 512 * Math.ceil(h.size / 512)
      if (position + entryBlockSize + 512 > size) {
        return cb(null, position)
      }

      position += entryBlockSize + 512
      if (position >= size) {
        return cb(null, position)
      }

      if (opt.mtimeCache) {
        opt.mtimeCache.set(h.path, h.mtime)
      }
      bufPos = 0
      fs.read(fd, headBuf, 0, 512, position, onread)
    }
    fs.read(fd, headBuf, 0, 512, position, onread)
  }

  const promise = new Promise((resolve, reject) => {
    p.on('error', reject)
    let flag = 'r+'
    const onopen = (er, fd) => {
      if (er && er.code === 'ENOENT' && flag === 'r+') {
        flag = 'w+'
        return fs.open(opt.file, flag, onopen)
      }

      if (er) {
        return reject(er)
      }

      fs.fstat(fd, (er, st) => {
        if (er) {
          return fs.close(fd, () => reject(er))
        }

        getPos(fd, st.size, (er, position) => {
          if (er) {
            return reject(er)
          }
          const stream = new fsm.WriteStream(opt.file, {
            fd: fd,
            start: position,
          })
          p.pipe(stream)
          stream.on('error', reject)
          stream.on('close', resolve)
          addFilesAsync(p, files)
        })
      })
    }
    fs.open(opt.file, flag, onopen)
  })

  return cb ? promise.then(cb, cb) : promise
}

const addFilesSync = (p, files) => {
  files.forEach(file => {
    if (file.charAt(0) === '@') {
      t({
        file: path.resolve(p.cwd, file.slice(1)),
        sync: true,
        noResume: true,
        onentry: entry => p.add(entry),
      })
    } else {
      p.add(file)
    }
  })
  p.end()
}

const addFilesAsync = (p, files) => {
  while (files.length) {
    const file = files.shift()
    if (file.charAt(0) === '@') {
      return t({
        file: path.resolve(p.cwd, file.slice(1)),
        noResume: true,
        onentry: entry => p.add(entry),
      }).then(_ => addFilesAsync(p, files))
    } else {
      p.add(file)
    }
  }
  p.end()
}


/***/ }),

/***/ 2190:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// unix absolute paths are also absolute on win32, so we use this for both
const { isAbsolute, parse } = (__webpack_require__(1017).win32)

// returns [root, stripped]
// Note that windows will think that //x/y/z/a has a "root" of //x/y, and in
// those cases, we want to sanitize it to x/y/z/a, not z/a, so we strip /
// explicitly if it's the first character.
// drive-specific relative paths on Windows get their root stripped off even
// though they are not absolute, so `c:../foo` becomes ['c:', '../foo']
module.exports = path => {
  let r = ''

  let parsed = parse(path)
  while (isAbsolute(path) || parsed.root) {
    // windows will think that //x/y/z has a "root" of //x/y/
    // but strip the //?/C:/ off of //?/C:/path
    const root = path.charAt(0) === '/' && path.slice(0, 4) !== '//?/' ? '/'
      : parsed.root
    path = path.slice(root.length)
    r += root
    parsed = parse(path)
  }
  return [r, path]
}


/***/ }),

/***/ 9812:
/***/ ((module) => {

// warning: extremely hot code path.
// This has been meticulously optimized for use
// within npm install on large package trees.
// Do not edit without careful benchmarking.
module.exports = str => {
  let i = str.length - 1
  let slashesStart = -1
  while (i > -1 && str.charAt(i) === '/') {
    slashesStart = i
    i--
  }
  return slashesStart === -1 ? str : str.slice(0, slashesStart)
}


/***/ }),

/***/ 2976:
/***/ ((__unused_webpack_module, exports) => {


// map types from key to human-friendly name
exports.name = new Map([
  ['0', 'File'],
  // same as File
  ['', 'OldFile'],
  ['1', 'Link'],
  ['2', 'SymbolicLink'],
  // Devices and FIFOs aren't fully supported
  // they are parsed, but skipped when unpacking
  ['3', 'CharacterDevice'],
  ['4', 'BlockDevice'],
  ['5', 'Directory'],
  ['6', 'FIFO'],
  // same as File
  ['7', 'ContiguousFile'],
  // pax headers
  ['g', 'GlobalExtendedHeader'],
  ['x', 'ExtendedHeader'],
  // vendor-specific stuff
  // skip
  ['A', 'SolarisACL'],
  // like 5, but with data, which should be skipped
  ['D', 'GNUDumpDir'],
  // metadata only, skip
  ['I', 'Inode'],
  // data = link path of next file
  ['K', 'NextFileHasLongLinkpath'],
  // data = path of next file
  ['L', 'NextFileHasLongPath'],
  // skip
  ['M', 'ContinuationFile'],
  // like L
  ['N', 'OldGnuLongPath'],
  // skip
  ['S', 'SparseFile'],
  // skip
  ['V', 'TapeVolumeHeader'],
  // like x
  ['X', 'OldExtendedHeader'],
])

// map the other direction
exports.code = new Map(Array.from(exports.name).map(kv => [kv[1], kv[0]]))


/***/ }),

/***/ 9800:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// the PEND/UNPEND stuff tracks whether we're ready to emit end/close yet.
// but the path reservations are required to avoid race conditions where
// parallelized unpack ops may mess with one another, due to dependencies
// (like a Link depending on its target) or destructive operations (like
// clobbering an fs object to create one of a different type.)

const assert = __webpack_require__(9491)
const Parser = __webpack_require__(3576)
const fs = __webpack_require__(7147)
const fsm = __webpack_require__(1354)
const path = __webpack_require__(1017)
const mkdir = __webpack_require__(7994)
const wc = __webpack_require__(3856)
const pathReservations = __webpack_require__(3712)
const stripAbsolutePath = __webpack_require__(2190)
const normPath = __webpack_require__(8407)
const stripSlash = __webpack_require__(9812)
const normalize = __webpack_require__(960)

const ONENTRY = Symbol('onEntry')
const CHECKFS = Symbol('checkFs')
const CHECKFS2 = Symbol('checkFs2')
const PRUNECACHE = Symbol('pruneCache')
const ISREUSABLE = Symbol('isReusable')
const MAKEFS = Symbol('makeFs')
const FILE = Symbol('file')
const DIRECTORY = Symbol('directory')
const LINK = Symbol('link')
const SYMLINK = Symbol('symlink')
const HARDLINK = Symbol('hardlink')
const UNSUPPORTED = Symbol('unsupported')
const CHECKPATH = Symbol('checkPath')
const MKDIR = Symbol('mkdir')
const ONERROR = Symbol('onError')
const PENDING = Symbol('pending')
const PEND = Symbol('pend')
const UNPEND = Symbol('unpend')
const ENDED = Symbol('ended')
const MAYBECLOSE = Symbol('maybeClose')
const SKIP = Symbol('skip')
const DOCHOWN = Symbol('doChown')
const UID = Symbol('uid')
const GID = Symbol('gid')
const CHECKED_CWD = Symbol('checkedCwd')
const crypto = __webpack_require__(6113)
const getFlag = __webpack_require__(9592)
const platform = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform
const isWindows = platform === 'win32'

// Unlinks on Windows are not atomic.
//
// This means that if you have a file entry, followed by another
// file entry with an identical name, and you cannot re-use the file
// (because it's a hardlink, or because unlink:true is set, or it's
// Windows, which does not have useful nlink values), then the unlink
// will be committed to the disk AFTER the new file has been written
// over the old one, deleting the new file.
//
// To work around this, on Windows systems, we rename the file and then
// delete the renamed file.  It's a sloppy kludge, but frankly, I do not
// know of a better way to do this, given windows' non-atomic unlink
// semantics.
//
// See: https://github.com/npm/node-tar/issues/183
/* istanbul ignore next */
const unlinkFile = (path, cb) => {
  if (!isWindows) {
    return fs.unlink(path, cb)
  }

  const name = path + '.DELETE.' + crypto.randomBytes(16).toString('hex')
  fs.rename(path, name, er => {
    if (er) {
      return cb(er)
    }
    fs.unlink(name, cb)
  })
}

/* istanbul ignore next */
const unlinkFileSync = path => {
  if (!isWindows) {
    return fs.unlinkSync(path)
  }

  const name = path + '.DELETE.' + crypto.randomBytes(16).toString('hex')
  fs.renameSync(path, name)
  fs.unlinkSync(name)
}

// this.gid, entry.gid, this.processUid
const uint32 = (a, b, c) =>
  a === a >>> 0 ? a
  : b === b >>> 0 ? b
  : c

// clear the cache if it's a case-insensitive unicode-squashing match.
// we can't know if the current file system is case-sensitive or supports
// unicode fully, so we check for similarity on the maximally compatible
// representation.  Err on the side of pruning, since all it's doing is
// preventing lstats, and it's not the end of the world if we get a false
// positive.
// Note that on windows, we always drop the entire cache whenever a
// symbolic link is encountered, because 8.3 filenames are impossible
// to reason about, and collisions are hazards rather than just failures.
const cacheKeyNormalize = path => stripSlash(normPath(normalize(path)))
  .toLowerCase()

const pruneCache = (cache, abs) => {
  abs = cacheKeyNormalize(abs)
  for (const path of cache.keys()) {
    const pnorm = cacheKeyNormalize(path)
    if (pnorm === abs || pnorm.indexOf(abs + '/') === 0) {
      cache.delete(path)
    }
  }
}

const dropCache = cache => {
  for (const key of cache.keys()) {
    cache.delete(key)
  }
}

class Unpack extends Parser {
  constructor (opt) {
    if (!opt) {
      opt = {}
    }

    opt.ondone = _ => {
      this[ENDED] = true
      this[MAYBECLOSE]()
    }

    super(opt)

    this[CHECKED_CWD] = false

    this.reservations = pathReservations()

    this.transform = typeof opt.transform === 'function' ? opt.transform : null

    this.writable = true
    this.readable = false

    this[PENDING] = 0
    this[ENDED] = false

    this.dirCache = opt.dirCache || new Map()

    if (typeof opt.uid === 'number' || typeof opt.gid === 'number') {
      // need both or neither
      if (typeof opt.uid !== 'number' || typeof opt.gid !== 'number') {
        throw new TypeError('cannot set owner without number uid and gid')
      }
      if (opt.preserveOwner) {
        throw new TypeError(
          'cannot preserve owner in archive and also set owner explicitly')
      }
      this.uid = opt.uid
      this.gid = opt.gid
      this.setOwner = true
    } else {
      this.uid = null
      this.gid = null
      this.setOwner = false
    }

    // default true for root
    if (opt.preserveOwner === undefined && typeof opt.uid !== 'number') {
      this.preserveOwner = process.getuid && process.getuid() === 0
    } else {
      this.preserveOwner = !!opt.preserveOwner
    }

    this.processUid = (this.preserveOwner || this.setOwner) && process.getuid ?
      process.getuid() : null
    this.processGid = (this.preserveOwner || this.setOwner) && process.getgid ?
      process.getgid() : null

    // mostly just for testing, but useful in some cases.
    // Forcibly trigger a chown on every entry, no matter what
    this.forceChown = opt.forceChown === true

    // turn ><?| in filenames into 0xf000-higher encoded forms
    this.win32 = !!opt.win32 || isWindows

    // do not unpack over files that are newer than what's in the archive
    this.newer = !!opt.newer

    // do not unpack over ANY files
    this.keep = !!opt.keep

    // do not set mtime/atime of extracted entries
    this.noMtime = !!opt.noMtime

    // allow .., absolute path entries, and unpacking through symlinks
    // without this, warn and skip .., relativize absolutes, and error
    // on symlinks in extraction path
    this.preservePaths = !!opt.preservePaths

    // unlink files and links before writing. This breaks existing hard
    // links, and removes symlink directories rather than erroring
    this.unlink = !!opt.unlink

    this.cwd = normPath(path.resolve(opt.cwd || process.cwd()))
    this.strip = +opt.strip || 0
    // if we're not chmodding, then we don't need the process umask
    this.processUmask = opt.noChmod ? 0 : process.umask()
    this.umask = typeof opt.umask === 'number' ? opt.umask : this.processUmask

    // default mode for dirs created as parents
    this.dmode = opt.dmode || (0o0777 & (~this.umask))
    this.fmode = opt.fmode || (0o0666 & (~this.umask))

    this.on('entry', entry => this[ONENTRY](entry))
  }

  // a bad or damaged archive is a warning for Parser, but an error
  // when extracting.  Mark those errors as unrecoverable, because
  // the Unpack contract cannot be met.
  warn (code, msg, data = {}) {
    if (code === 'TAR_BAD_ARCHIVE' || code === 'TAR_ABORT') {
      data.recoverable = false
    }
    return super.warn(code, msg, data)
  }

  [MAYBECLOSE] () {
    if (this[ENDED] && this[PENDING] === 0) {
      this.emit('prefinish')
      this.emit('finish')
      this.emit('end')
    }
  }

  [CHECKPATH] (entry) {
    if (this.strip) {
      const parts = normPath(entry.path).split('/')
      if (parts.length < this.strip) {
        return false
      }
      entry.path = parts.slice(this.strip).join('/')

      if (entry.type === 'Link') {
        const linkparts = normPath(entry.linkpath).split('/')
        if (linkparts.length >= this.strip) {
          entry.linkpath = linkparts.slice(this.strip).join('/')
        } else {
          return false
        }
      }
    }

    if (!this.preservePaths) {
      const p = normPath(entry.path)
      const parts = p.split('/')
      if (parts.includes('..') || isWindows && /^[a-z]:\.\.$/i.test(parts[0])) {
        this.warn('TAR_ENTRY_ERROR', `path contains '..'`, {
          entry,
          path: p,
        })
        return false
      }

      // strip off the root
      const [root, stripped] = stripAbsolutePath(p)
      if (root) {
        entry.path = stripped
        this.warn('TAR_ENTRY_INFO', `stripping ${root} from absolute path`, {
          entry,
          path: p,
        })
      }
    }

    if (path.isAbsolute(entry.path)) {
      entry.absolute = normPath(path.resolve(entry.path))
    } else {
      entry.absolute = normPath(path.resolve(this.cwd, entry.path))
    }

    // if we somehow ended up with a path that escapes the cwd, and we are
    // not in preservePaths mode, then something is fishy!  This should have
    // been prevented above, so ignore this for coverage.
    /* istanbul ignore if - defense in depth */
    if (!this.preservePaths &&
        entry.absolute.indexOf(this.cwd + '/') !== 0 &&
        entry.absolute !== this.cwd) {
      this.warn('TAR_ENTRY_ERROR', 'path escaped extraction target', {
        entry,
        path: normPath(entry.path),
        resolvedPath: entry.absolute,
        cwd: this.cwd,
      })
      return false
    }

    // an archive can set properties on the extraction directory, but it
    // may not replace the cwd with a different kind of thing entirely.
    if (entry.absolute === this.cwd &&
        entry.type !== 'Directory' &&
        entry.type !== 'GNUDumpDir') {
      return false
    }

    // only encode : chars that aren't drive letter indicators
    if (this.win32) {
      const { root: aRoot } = path.win32.parse(entry.absolute)
      entry.absolute = aRoot + wc.encode(entry.absolute.slice(aRoot.length))
      const { root: pRoot } = path.win32.parse(entry.path)
      entry.path = pRoot + wc.encode(entry.path.slice(pRoot.length))
    }

    return true
  }

  [ONENTRY] (entry) {
    if (!this[CHECKPATH](entry)) {
      return entry.resume()
    }

    assert.equal(typeof entry.absolute, 'string')

    switch (entry.type) {
      case 'Directory':
      case 'GNUDumpDir':
        if (entry.mode) {
          entry.mode = entry.mode | 0o700
        }

      // eslint-disable-next-line no-fallthrough
      case 'File':
      case 'OldFile':
      case 'ContiguousFile':
      case 'Link':
      case 'SymbolicLink':
        return this[CHECKFS](entry)

      case 'CharacterDevice':
      case 'BlockDevice':
      case 'FIFO':
      default:
        return this[UNSUPPORTED](entry)
    }
  }

  [ONERROR] (er, entry) {
    // Cwd has to exist, or else nothing works. That's serious.
    // Other errors are warnings, which raise the error in strict
    // mode, but otherwise continue on.
    if (er.name === 'CwdError') {
      this.emit('error', er)
    } else {
      this.warn('TAR_ENTRY_ERROR', er, { entry })
      this[UNPEND]()
      entry.resume()
    }
  }

  [MKDIR] (dir, mode, cb) {
    mkdir(normPath(dir), {
      uid: this.uid,
      gid: this.gid,
      processUid: this.processUid,
      processGid: this.processGid,
      umask: this.processUmask,
      preserve: this.preservePaths,
      unlink: this.unlink,
      cache: this.dirCache,
      cwd: this.cwd,
      mode: mode,
      noChmod: this.noChmod,
    }, cb)
  }

  [DOCHOWN] (entry) {
    // in preserve owner mode, chown if the entry doesn't match process
    // in set owner mode, chown if setting doesn't match process
    return this.forceChown ||
      this.preserveOwner &&
      (typeof entry.uid === 'number' && entry.uid !== this.processUid ||
        typeof entry.gid === 'number' && entry.gid !== this.processGid)
      ||
      (typeof this.uid === 'number' && this.uid !== this.processUid ||
        typeof this.gid === 'number' && this.gid !== this.processGid)
  }

  [UID] (entry) {
    return uint32(this.uid, entry.uid, this.processUid)
  }

  [GID] (entry) {
    return uint32(this.gid, entry.gid, this.processGid)
  }

  [FILE] (entry, fullyDone) {
    const mode = entry.mode & 0o7777 || this.fmode
    const stream = new fsm.WriteStream(entry.absolute, {
      flags: getFlag(entry.size),
      mode: mode,
      autoClose: false,
    })
    stream.on('error', er => {
      if (stream.fd) {
        fs.close(stream.fd, () => {})
      }

      // flush all the data out so that we aren't left hanging
      // if the error wasn't actually fatal.  otherwise the parse
      // is blocked, and we never proceed.
      stream.write = () => true
      this[ONERROR](er, entry)
      fullyDone()
    })

    let actions = 1
    const done = er => {
      if (er) {
        /* istanbul ignore else - we should always have a fd by now */
        if (stream.fd) {
          fs.close(stream.fd, () => {})
        }

        this[ONERROR](er, entry)
        fullyDone()
        return
      }

      if (--actions === 0) {
        fs.close(stream.fd, er => {
          if (er) {
            this[ONERROR](er, entry)
          } else {
            this[UNPEND]()
          }
          fullyDone()
        })
      }
    }

    stream.on('finish', _ => {
      // if futimes fails, try utimes
      // if utimes fails, fail with the original error
      // same for fchown/chown
      const abs = entry.absolute
      const fd = stream.fd

      if (entry.mtime && !this.noMtime) {
        actions++
        const atime = entry.atime || new Date()
        const mtime = entry.mtime
        fs.futimes(fd, atime, mtime, er =>
          er ? fs.utimes(abs, atime, mtime, er2 => done(er2 && er))
          : done())
      }

      if (this[DOCHOWN](entry)) {
        actions++
        const uid = this[UID](entry)
        const gid = this[GID](entry)
        fs.fchown(fd, uid, gid, er =>
          er ? fs.chown(abs, uid, gid, er2 => done(er2 && er))
          : done())
      }

      done()
    })

    const tx = this.transform ? this.transform(entry) || entry : entry
    if (tx !== entry) {
      tx.on('error', er => {
        this[ONERROR](er, entry)
        fullyDone()
      })
      entry.pipe(tx)
    }
    tx.pipe(stream)
  }

  [DIRECTORY] (entry, fullyDone) {
    const mode = entry.mode & 0o7777 || this.dmode
    this[MKDIR](entry.absolute, mode, er => {
      if (er) {
        this[ONERROR](er, entry)
        fullyDone()
        return
      }

      let actions = 1
      const done = _ => {
        if (--actions === 0) {
          fullyDone()
          this[UNPEND]()
          entry.resume()
        }
      }

      if (entry.mtime && !this.noMtime) {
        actions++
        fs.utimes(entry.absolute, entry.atime || new Date(), entry.mtime, done)
      }

      if (this[DOCHOWN](entry)) {
        actions++
        fs.chown(entry.absolute, this[UID](entry), this[GID](entry), done)
      }

      done()
    })
  }

  [UNSUPPORTED] (entry) {
    entry.unsupported = true
    this.warn('TAR_ENTRY_UNSUPPORTED',
      `unsupported entry type: ${entry.type}`, { entry })
    entry.resume()
  }

  [SYMLINK] (entry, done) {
    this[LINK](entry, entry.linkpath, 'symlink', done)
  }

  [HARDLINK] (entry, done) {
    const linkpath = normPath(path.resolve(this.cwd, entry.linkpath))
    this[LINK](entry, linkpath, 'link', done)
  }

  [PEND] () {
    this[PENDING]++
  }

  [UNPEND] () {
    this[PENDING]--
    this[MAYBECLOSE]()
  }

  [SKIP] (entry) {
    this[UNPEND]()
    entry.resume()
  }

  // Check if we can reuse an existing filesystem entry safely and
  // overwrite it, rather than unlinking and recreating
  // Windows doesn't report a useful nlink, so we just never reuse entries
  [ISREUSABLE] (entry, st) {
    return entry.type === 'File' &&
      !this.unlink &&
      st.isFile() &&
      st.nlink <= 1 &&
      !isWindows
  }

  // check if a thing is there, and if so, try to clobber it
  [CHECKFS] (entry) {
    this[PEND]()
    const paths = [entry.path]
    if (entry.linkpath) {
      paths.push(entry.linkpath)
    }
    this.reservations.reserve(paths, done => this[CHECKFS2](entry, done))
  }

  [PRUNECACHE] (entry) {
    // if we are not creating a directory, and the path is in the dirCache,
    // then that means we are about to delete the directory we created
    // previously, and it is no longer going to be a directory, and neither
    // is any of its children.
    // If a symbolic link is encountered, all bets are off.  There is no
    // reasonable way to sanitize the cache in such a way we will be able to
    // avoid having filesystem collisions.  If this happens with a non-symlink
    // entry, it'll just fail to unpack, but a symlink to a directory, using an
    // 8.3 shortname or certain unicode attacks, can evade detection and lead
    // to arbitrary writes to anywhere on the system.
    if (entry.type === 'SymbolicLink') {
      dropCache(this.dirCache)
    } else if (entry.type !== 'Directory') {
      pruneCache(this.dirCache, entry.absolute)
    }
  }

  [CHECKFS2] (entry, fullyDone) {
    this[PRUNECACHE](entry)

    const done = er => {
      this[PRUNECACHE](entry)
      fullyDone(er)
    }

    const checkCwd = () => {
      this[MKDIR](this.cwd, this.dmode, er => {
        if (er) {
          this[ONERROR](er, entry)
          done()
          return
        }
        this[CHECKED_CWD] = true
        start()
      })
    }

    const start = () => {
      if (entry.absolute !== this.cwd) {
        const parent = normPath(path.dirname(entry.absolute))
        if (parent !== this.cwd) {
          return this[MKDIR](parent, this.dmode, er => {
            if (er) {
              this[ONERROR](er, entry)
              done()
              return
            }
            afterMakeParent()
          })
        }
      }
      afterMakeParent()
    }

    const afterMakeParent = () => {
      fs.lstat(entry.absolute, (lstatEr, st) => {
        if (st && (this.keep || this.newer && st.mtime > entry.mtime)) {
          this[SKIP](entry)
          done()
          return
        }
        if (lstatEr || this[ISREUSABLE](entry, st)) {
          return this[MAKEFS](null, entry, done)
        }

        if (st.isDirectory()) {
          if (entry.type === 'Directory') {
            const needChmod = !this.noChmod &&
              entry.mode &&
              (st.mode & 0o7777) !== entry.mode
            const afterChmod = er => this[MAKEFS](er, entry, done)
            if (!needChmod) {
              return afterChmod()
            }
            return fs.chmod(entry.absolute, entry.mode, afterChmod)
          }
          // Not a dir entry, have to remove it.
          // NB: the only way to end up with an entry that is the cwd
          // itself, in such a way that == does not detect, is a
          // tricky windows absolute path with UNC or 8.3 parts (and
          // preservePaths:true, or else it will have been stripped).
          // In that case, the user has opted out of path protections
          // explicitly, so if they blow away the cwd, c'est la vie.
          if (entry.absolute !== this.cwd) {
            return fs.rmdir(entry.absolute, er =>
              this[MAKEFS](er, entry, done))
          }
        }

        // not a dir, and not reusable
        // don't remove if the cwd, we want that error
        if (entry.absolute === this.cwd) {
          return this[MAKEFS](null, entry, done)
        }

        unlinkFile(entry.absolute, er =>
          this[MAKEFS](er, entry, done))
      })
    }

    if (this[CHECKED_CWD]) {
      start()
    } else {
      checkCwd()
    }
  }

  [MAKEFS] (er, entry, done) {
    if (er) {
      this[ONERROR](er, entry)
      done()
      return
    }

    switch (entry.type) {
      case 'File':
      case 'OldFile':
      case 'ContiguousFile':
        return this[FILE](entry, done)

      case 'Link':
        return this[HARDLINK](entry, done)

      case 'SymbolicLink':
        return this[SYMLINK](entry, done)

      case 'Directory':
      case 'GNUDumpDir':
        return this[DIRECTORY](entry, done)
    }
  }

  [LINK] (entry, linkpath, link, done) {
    // XXX: get the type ('symlink' or 'junction') for windows
    fs[link](linkpath, entry.absolute, er => {
      if (er) {
        this[ONERROR](er, entry)
      } else {
        this[UNPEND]()
        entry.resume()
      }
      done()
    })
  }
}

const callSync = fn => {
  try {
    return [null, fn()]
  } catch (er) {
    return [er, null]
  }
}
class UnpackSync extends Unpack {
  [MAKEFS] (er, entry) {
    return super[MAKEFS](er, entry, () => {})
  }

  [CHECKFS] (entry) {
    this[PRUNECACHE](entry)

    if (!this[CHECKED_CWD]) {
      const er = this[MKDIR](this.cwd, this.dmode)
      if (er) {
        return this[ONERROR](er, entry)
      }
      this[CHECKED_CWD] = true
    }

    // don't bother to make the parent if the current entry is the cwd,
    // we've already checked it.
    if (entry.absolute !== this.cwd) {
      const parent = normPath(path.dirname(entry.absolute))
      if (parent !== this.cwd) {
        const mkParent = this[MKDIR](parent, this.dmode)
        if (mkParent) {
          return this[ONERROR](mkParent, entry)
        }
      }
    }

    const [lstatEr, st] = callSync(() => fs.lstatSync(entry.absolute))
    if (st && (this.keep || this.newer && st.mtime > entry.mtime)) {
      return this[SKIP](entry)
    }

    if (lstatEr || this[ISREUSABLE](entry, st)) {
      return this[MAKEFS](null, entry)
    }

    if (st.isDirectory()) {
      if (entry.type === 'Directory') {
        const needChmod = !this.noChmod &&
          entry.mode &&
          (st.mode & 0o7777) !== entry.mode
        const [er] = needChmod ? callSync(() => {
          fs.chmodSync(entry.absolute, entry.mode)
        }) : []
        return this[MAKEFS](er, entry)
      }
      // not a dir entry, have to remove it
      const [er] = callSync(() => fs.rmdirSync(entry.absolute))
      this[MAKEFS](er, entry)
    }

    // not a dir, and not reusable.
    // don't remove if it's the cwd, since we want that error.
    const [er] = entry.absolute === this.cwd ? []
      : callSync(() => unlinkFileSync(entry.absolute))
    this[MAKEFS](er, entry)
  }

  [FILE] (entry, done) {
    const mode = entry.mode & 0o7777 || this.fmode

    const oner = er => {
      let closeError
      try {
        fs.closeSync(fd)
      } catch (e) {
        closeError = e
      }
      if (er || closeError) {
        this[ONERROR](er || closeError, entry)
      }
      done()
    }

    let fd
    try {
      fd = fs.openSync(entry.absolute, getFlag(entry.size), mode)
    } catch (er) {
      return oner(er)
    }
    const tx = this.transform ? this.transform(entry) || entry : entry
    if (tx !== entry) {
      tx.on('error', er => this[ONERROR](er, entry))
      entry.pipe(tx)
    }

    tx.on('data', chunk => {
      try {
        fs.writeSync(fd, chunk, 0, chunk.length)
      } catch (er) {
        oner(er)
      }
    })

    tx.on('end', _ => {
      let er = null
      // try both, falling futimes back to utimes
      // if either fails, handle the first error
      if (entry.mtime && !this.noMtime) {
        const atime = entry.atime || new Date()
        const mtime = entry.mtime
        try {
          fs.futimesSync(fd, atime, mtime)
        } catch (futimeser) {
          try {
            fs.utimesSync(entry.absolute, atime, mtime)
          } catch (utimeser) {
            er = futimeser
          }
        }
      }

      if (this[DOCHOWN](entry)) {
        const uid = this[UID](entry)
        const gid = this[GID](entry)

        try {
          fs.fchownSync(fd, uid, gid)
        } catch (fchowner) {
          try {
            fs.chownSync(entry.absolute, uid, gid)
          } catch (chowner) {
            er = er || fchowner
          }
        }
      }

      oner(er)
    })
  }

  [DIRECTORY] (entry, done) {
    const mode = entry.mode & 0o7777 || this.dmode
    const er = this[MKDIR](entry.absolute, mode)
    if (er) {
      this[ONERROR](er, entry)
      done()
      return
    }
    if (entry.mtime && !this.noMtime) {
      try {
        fs.utimesSync(entry.absolute, entry.atime || new Date(), entry.mtime)
      } catch (er) {}
    }
    if (this[DOCHOWN](entry)) {
      try {
        fs.chownSync(entry.absolute, this[UID](entry), this[GID](entry))
      } catch (er) {}
    }
    done()
    entry.resume()
  }

  [MKDIR] (dir, mode) {
    try {
      return mkdir.sync(normPath(dir), {
        uid: this.uid,
        gid: this.gid,
        processUid: this.processUid,
        processGid: this.processGid,
        umask: this.processUmask,
        preserve: this.preservePaths,
        unlink: this.unlink,
        cache: this.dirCache,
        cwd: this.cwd,
        mode: mode,
      })
    } catch (er) {
      return er
    }
  }

  [LINK] (entry, linkpath, link, done) {
    try {
      fs[link + 'Sync'](linkpath, entry.absolute)
      done()
      entry.resume()
    } catch (er) {
      return this[ONERROR](er, entry)
    }
  }
}

Unpack.Sync = UnpackSync
module.exports = Unpack


/***/ }),

/***/ 7488:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



// tar -u

const hlo = __webpack_require__(8052)
const r = __webpack_require__(6562)
// just call tar.r with the filter and mtimeCache

module.exports = (opt_, files, cb) => {
  const opt = hlo(opt_)

  if (!opt.file) {
    throw new TypeError('file is required')
  }

  if (opt.gzip) {
    throw new TypeError('cannot append to compressed archives')
  }

  if (!files || !Array.isArray(files) || !files.length) {
    throw new TypeError('no files or directories specified')
  }

  files = Array.from(files)

  mtimeFilter(opt)
  return r(opt, files, cb)
}

const mtimeFilter = opt => {
  const filter = opt.filter

  if (!opt.mtimeCache) {
    opt.mtimeCache = new Map()
  }

  opt.filter = filter ? (path, stat) =>
    filter(path, stat) && !(opt.mtimeCache.get(path) > stat.mtime)
    : (path, stat) => !(opt.mtimeCache.get(path) > stat.mtime)
}


/***/ }),

/***/ 1634:
/***/ ((module) => {


module.exports = Base => class extends Base {
  warn (code, message, data = {}) {
    if (this.file) {
      data.file = this.file
    }
    if (this.cwd) {
      data.cwd = this.cwd
    }
    data.code = message instanceof Error && message.code || code
    data.tarCode = code
    if (!this.strict && data.recoverable !== false) {
      if (message instanceof Error) {
        data = Object.assign(message, data)
        message = message.message
      }
      this.emit('warn', data.tarCode, message, data)
    } else if (message instanceof Error) {
      this.emit('error', Object.assign(message, data))
    } else {
      this.emit('error', Object.assign(new Error(`${code}: ${message}`), data))
    }
  }
}


/***/ }),

/***/ 3856:
/***/ ((module) => {



// When writing files on Windows, translate the characters to their
// 0xf000 higher-encoded versions.

const raw = [
  '|',
  '<',
  '>',
  '?',
  ':',
]

const win = raw.map(char =>
  String.fromCharCode(0xf000 + char.charCodeAt(0)))

const toWin = new Map(raw.map((char, i) => [char, win[i]]))
const toRaw = new Map(win.map((char, i) => [char, raw[i]]))

module.exports = {
  encode: s => raw.reduce((s, c) => s.split(c).join(toWin.get(c)), s),
  decode: s => win.reduce((s, c) => s.split(c).join(toRaw.get(c)), s),
}


/***/ }),

/***/ 6900:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const { Minipass } = __webpack_require__(8759)
const Pax = __webpack_require__(476)
const Header = __webpack_require__(9868)
const fs = __webpack_require__(7147)
const path = __webpack_require__(1017)
const normPath = __webpack_require__(8407)
const stripSlash = __webpack_require__(9812)

const prefixPath = (path, prefix) => {
  if (!prefix) {
    return normPath(path)
  }
  path = normPath(path).replace(/^\.(\/|$)/, '')
  return stripSlash(prefix) + '/' + path
}

const maxReadSize = 16 * 1024 * 1024
const PROCESS = Symbol('process')
const FILE = Symbol('file')
const DIRECTORY = Symbol('directory')
const SYMLINK = Symbol('symlink')
const HARDLINK = Symbol('hardlink')
const HEADER = Symbol('header')
const READ = Symbol('read')
const LSTAT = Symbol('lstat')
const ONLSTAT = Symbol('onlstat')
const ONREAD = Symbol('onread')
const ONREADLINK = Symbol('onreadlink')
const OPENFILE = Symbol('openfile')
const ONOPENFILE = Symbol('onopenfile')
const CLOSE = Symbol('close')
const MODE = Symbol('mode')
const AWAITDRAIN = Symbol('awaitDrain')
const ONDRAIN = Symbol('ondrain')
const PREFIX = Symbol('prefix')
const HAD_ERROR = Symbol('hadError')
const warner = __webpack_require__(1634)
const winchars = __webpack_require__(3856)
const stripAbsolutePath = __webpack_require__(2190)

const modeFix = __webpack_require__(8833)

const WriteEntry = warner(class WriteEntry extends Minipass {
  constructor (p, opt) {
    opt = opt || {}
    super(opt)
    if (typeof p !== 'string') {
      throw new TypeError('path is required')
    }
    this.path = normPath(p)
    // suppress atime, ctime, uid, gid, uname, gname
    this.portable = !!opt.portable
    // until node has builtin pwnam functions, this'll have to do
    this.myuid = process.getuid && process.getuid() || 0
    this.myuser = process.env.USER || ''
    this.maxReadSize = opt.maxReadSize || maxReadSize
    this.linkCache = opt.linkCache || new Map()
    this.statCache = opt.statCache || new Map()
    this.preservePaths = !!opt.preservePaths
    this.cwd = normPath(opt.cwd || process.cwd())
    this.strict = !!opt.strict
    this.noPax = !!opt.noPax
    this.noMtime = !!opt.noMtime
    this.mtime = opt.mtime || null
    this.prefix = opt.prefix ? normPath(opt.prefix) : null

    this.fd = null
    this.blockLen = null
    this.blockRemain = null
    this.buf = null
    this.offset = null
    this.length = null
    this.pos = null
    this.remain = null

    if (typeof opt.onwarn === 'function') {
      this.on('warn', opt.onwarn)
    }

    let pathWarn = false
    if (!this.preservePaths) {
      const [root, stripped] = stripAbsolutePath(this.path)
      if (root) {
        this.path = stripped
        pathWarn = root
      }
    }

    this.win32 = !!opt.win32 || process.platform === 'win32'
    if (this.win32) {
      // force the \ to / normalization, since we might not *actually*
      // be on windows, but want \ to be considered a path separator.
      this.path = winchars.decode(this.path.replace(/\\/g, '/'))
      p = p.replace(/\\/g, '/')
    }

    this.absolute = normPath(opt.absolute || path.resolve(this.cwd, p))

    if (this.path === '') {
      this.path = './'
    }

    if (pathWarn) {
      this.warn('TAR_ENTRY_INFO', `stripping ${pathWarn} from absolute path`, {
        entry: this,
        path: pathWarn + this.path,
      })
    }

    if (this.statCache.has(this.absolute)) {
      this[ONLSTAT](this.statCache.get(this.absolute))
    } else {
      this[LSTAT]()
    }
  }

  emit (ev, ...data) {
    if (ev === 'error') {
      this[HAD_ERROR] = true
    }
    return super.emit(ev, ...data)
  }

  [LSTAT] () {
    fs.lstat(this.absolute, (er, stat) => {
      if (er) {
        return this.emit('error', er)
      }
      this[ONLSTAT](stat)
    })
  }

  [ONLSTAT] (stat) {
    this.statCache.set(this.absolute, stat)
    this.stat = stat
    if (!stat.isFile()) {
      stat.size = 0
    }
    this.type = getType(stat)
    this.emit('stat', stat)
    this[PROCESS]()
  }

  [PROCESS] () {
    switch (this.type) {
      case 'File': return this[FILE]()
      case 'Directory': return this[DIRECTORY]()
      case 'SymbolicLink': return this[SYMLINK]()
      // unsupported types are ignored.
      default: return this.end()
    }
  }

  [MODE] (mode) {
    return modeFix(mode, this.type === 'Directory', this.portable)
  }

  [PREFIX] (path) {
    return prefixPath(path, this.prefix)
  }

  [HEADER] () {
    if (this.type === 'Directory' && this.portable) {
      this.noMtime = true
    }

    this.header = new Header({
      path: this[PREFIX](this.path),
      // only apply the prefix to hard links.
      linkpath: this.type === 'Link' ? this[PREFIX](this.linkpath)
      : this.linkpath,
      // only the permissions and setuid/setgid/sticky bitflags
      // not the higher-order bits that specify file type
      mode: this[MODE](this.stat.mode),
      uid: this.portable ? null : this.stat.uid,
      gid: this.portable ? null : this.stat.gid,
      size: this.stat.size,
      mtime: this.noMtime ? null : this.mtime || this.stat.mtime,
      type: this.type,
      uname: this.portable ? null :
      this.stat.uid === this.myuid ? this.myuser : '',
      atime: this.portable ? null : this.stat.atime,
      ctime: this.portable ? null : this.stat.ctime,
    })

    if (this.header.encode() && !this.noPax) {
      super.write(new Pax({
        atime: this.portable ? null : this.header.atime,
        ctime: this.portable ? null : this.header.ctime,
        gid: this.portable ? null : this.header.gid,
        mtime: this.noMtime ? null : this.mtime || this.header.mtime,
        path: this[PREFIX](this.path),
        linkpath: this.type === 'Link' ? this[PREFIX](this.linkpath)
        : this.linkpath,
        size: this.header.size,
        uid: this.portable ? null : this.header.uid,
        uname: this.portable ? null : this.header.uname,
        dev: this.portable ? null : this.stat.dev,
        ino: this.portable ? null : this.stat.ino,
        nlink: this.portable ? null : this.stat.nlink,
      }).encode())
    }
    super.write(this.header.block)
  }

  [DIRECTORY] () {
    if (this.path.slice(-1) !== '/') {
      this.path += '/'
    }
    this.stat.size = 0
    this[HEADER]()
    this.end()
  }

  [SYMLINK] () {
    fs.readlink(this.absolute, (er, linkpath) => {
      if (er) {
        return this.emit('error', er)
      }
      this[ONREADLINK](linkpath)
    })
  }

  [ONREADLINK] (linkpath) {
    this.linkpath = normPath(linkpath)
    this[HEADER]()
    this.end()
  }

  [HARDLINK] (linkpath) {
    this.type = 'Link'
    this.linkpath = normPath(path.relative(this.cwd, linkpath))
    this.stat.size = 0
    this[HEADER]()
    this.end()
  }

  [FILE] () {
    if (this.stat.nlink > 1) {
      const linkKey = this.stat.dev + ':' + this.stat.ino
      if (this.linkCache.has(linkKey)) {
        const linkpath = this.linkCache.get(linkKey)
        if (linkpath.indexOf(this.cwd) === 0) {
          return this[HARDLINK](linkpath)
        }
      }
      this.linkCache.set(linkKey, this.absolute)
    }

    this[HEADER]()
    if (this.stat.size === 0) {
      return this.end()
    }

    this[OPENFILE]()
  }

  [OPENFILE] () {
    fs.open(this.absolute, 'r', (er, fd) => {
      if (er) {
        return this.emit('error', er)
      }
      this[ONOPENFILE](fd)
    })
  }

  [ONOPENFILE] (fd) {
    this.fd = fd
    if (this[HAD_ERROR]) {
      return this[CLOSE]()
    }

    this.blockLen = 512 * Math.ceil(this.stat.size / 512)
    this.blockRemain = this.blockLen
    const bufLen = Math.min(this.blockLen, this.maxReadSize)
    this.buf = Buffer.allocUnsafe(bufLen)
    this.offset = 0
    this.pos = 0
    this.remain = this.stat.size
    this.length = this.buf.length
    this[READ]()
  }

  [READ] () {
    const { fd, buf, offset, length, pos } = this
    fs.read(fd, buf, offset, length, pos, (er, bytesRead) => {
      if (er) {
        // ignoring the error from close(2) is a bad practice, but at
        // this point we already have an error, don't need another one
        return this[CLOSE](() => this.emit('error', er))
      }
      this[ONREAD](bytesRead)
    })
  }

  [CLOSE] (cb) {
    fs.close(this.fd, cb)
  }

  [ONREAD] (bytesRead) {
    if (bytesRead <= 0 && this.remain > 0) {
      const er = new Error('encountered unexpected EOF')
      er.path = this.absolute
      er.syscall = 'read'
      er.code = 'EOF'
      return this[CLOSE](() => this.emit('error', er))
    }

    if (bytesRead > this.remain) {
      const er = new Error('did not encounter expected EOF')
      er.path = this.absolute
      er.syscall = 'read'
      er.code = 'EOF'
      return this[CLOSE](() => this.emit('error', er))
    }

    // null out the rest of the buffer, if we could fit the block padding
    // at the end of this loop, we've incremented bytesRead and this.remain
    // to be incremented up to the blockRemain level, as if we had expected
    // to get a null-padded file, and read it until the end.  then we will
    // decrement both remain and blockRemain by bytesRead, and know that we
    // reached the expected EOF, without any null buffer to append.
    if (bytesRead === this.remain) {
      for (let i = bytesRead; i < this.length && bytesRead < this.blockRemain; i++) {
        this.buf[i + this.offset] = 0
        bytesRead++
        this.remain++
      }
    }

    const writeBuf = this.offset === 0 && bytesRead === this.buf.length ?
      this.buf : this.buf.slice(this.offset, this.offset + bytesRead)

    const flushed = this.write(writeBuf)
    if (!flushed) {
      this[AWAITDRAIN](() => this[ONDRAIN]())
    } else {
      this[ONDRAIN]()
    }
  }

  [AWAITDRAIN] (cb) {
    this.once('drain', cb)
  }

  write (writeBuf) {
    if (this.blockRemain < writeBuf.length) {
      const er = new Error('writing more data than expected')
      er.path = this.absolute
      return this.emit('error', er)
    }
    this.remain -= writeBuf.length
    this.blockRemain -= writeBuf.length
    this.pos += writeBuf.length
    this.offset += writeBuf.length
    return super.write(writeBuf)
  }

  [ONDRAIN] () {
    if (!this.remain) {
      if (this.blockRemain) {
        super.write(Buffer.alloc(this.blockRemain))
      }
      return this[CLOSE](er => er ? this.emit('error', er) : this.end())
    }

    if (this.offset >= this.length) {
      // if we only have a smaller bit left to read, alloc a smaller buffer
      // otherwise, keep it the same length it was before.
      this.buf = Buffer.allocUnsafe(Math.min(this.blockRemain, this.buf.length))
      this.offset = 0
    }
    this.length = this.buf.length - this.offset
    this[READ]()
  }
})

class WriteEntrySync extends WriteEntry {
  [LSTAT] () {
    this[ONLSTAT](fs.lstatSync(this.absolute))
  }

  [SYMLINK] () {
    this[ONREADLINK](fs.readlinkSync(this.absolute))
  }

  [OPENFILE] () {
    this[ONOPENFILE](fs.openSync(this.absolute, 'r'))
  }

  [READ] () {
    let threw = true
    try {
      const { fd, buf, offset, length, pos } = this
      const bytesRead = fs.readSync(fd, buf, offset, length, pos)
      this[ONREAD](bytesRead)
      threw = false
    } finally {
      // ignoring the error from close(2) is a bad practice, but at
      // this point we already have an error, don't need another one
      if (threw) {
        try {
          this[CLOSE](() => {})
        } catch (er) {}
      }
    }
  }

  [AWAITDRAIN] (cb) {
    cb()
  }

  [CLOSE] (cb) {
    fs.closeSync(this.fd)
    cb()
  }
}

const WriteEntryTar = warner(class WriteEntryTar extends Minipass {
  constructor (readEntry, opt) {
    opt = opt || {}
    super(opt)
    this.preservePaths = !!opt.preservePaths
    this.portable = !!opt.portable
    this.strict = !!opt.strict
    this.noPax = !!opt.noPax
    this.noMtime = !!opt.noMtime

    this.readEntry = readEntry
    this.type = readEntry.type
    if (this.type === 'Directory' && this.portable) {
      this.noMtime = true
    }

    this.prefix = opt.prefix || null

    this.path = normPath(readEntry.path)
    this.mode = this[MODE](readEntry.mode)
    this.uid = this.portable ? null : readEntry.uid
    this.gid = this.portable ? null : readEntry.gid
    this.uname = this.portable ? null : readEntry.uname
    this.gname = this.portable ? null : readEntry.gname
    this.size = readEntry.size
    this.mtime = this.noMtime ? null : opt.mtime || readEntry.mtime
    this.atime = this.portable ? null : readEntry.atime
    this.ctime = this.portable ? null : readEntry.ctime
    this.linkpath = normPath(readEntry.linkpath)

    if (typeof opt.onwarn === 'function') {
      this.on('warn', opt.onwarn)
    }

    let pathWarn = false
    if (!this.preservePaths) {
      const [root, stripped] = stripAbsolutePath(this.path)
      if (root) {
        this.path = stripped
        pathWarn = root
      }
    }

    this.remain = readEntry.size
    this.blockRemain = readEntry.startBlockSize

    this.header = new Header({
      path: this[PREFIX](this.path),
      linkpath: this.type === 'Link' ? this[PREFIX](this.linkpath)
      : this.linkpath,
      // only the permissions and setuid/setgid/sticky bitflags
      // not the higher-order bits that specify file type
      mode: this.mode,
      uid: this.portable ? null : this.uid,
      gid: this.portable ? null : this.gid,
      size: this.size,
      mtime: this.noMtime ? null : this.mtime,
      type: this.type,
      uname: this.portable ? null : this.uname,
      atime: this.portable ? null : this.atime,
      ctime: this.portable ? null : this.ctime,
    })

    if (pathWarn) {
      this.warn('TAR_ENTRY_INFO', `stripping ${pathWarn} from absolute path`, {
        entry: this,
        path: pathWarn + this.path,
      })
    }

    if (this.header.encode() && !this.noPax) {
      super.write(new Pax({
        atime: this.portable ? null : this.atime,
        ctime: this.portable ? null : this.ctime,
        gid: this.portable ? null : this.gid,
        mtime: this.noMtime ? null : this.mtime,
        path: this[PREFIX](this.path),
        linkpath: this.type === 'Link' ? this[PREFIX](this.linkpath)
        : this.linkpath,
        size: this.size,
        uid: this.portable ? null : this.uid,
        uname: this.portable ? null : this.uname,
        dev: this.portable ? null : this.readEntry.dev,
        ino: this.portable ? null : this.readEntry.ino,
        nlink: this.portable ? null : this.readEntry.nlink,
      }).encode())
    }

    super.write(this.header.block)
    readEntry.pipe(this)
  }

  [PREFIX] (path) {
    return prefixPath(path, this.prefix)
  }

  [MODE] (mode) {
    return modeFix(mode, this.type === 'Directory', this.portable)
  }

  write (data) {
    const writeLen = data.length
    if (writeLen > this.blockRemain) {
      throw new Error('writing more to entry than is appropriate')
    }
    this.blockRemain -= writeLen
    return super.write(data)
  }

  end () {
    if (this.blockRemain) {
      super.write(Buffer.alloc(this.blockRemain))
    }
    return super.end()
  }
})

WriteEntry.Sync = WriteEntrySync
WriteEntry.Tar = WriteEntryTar

const getType = stat =>
  stat.isFile() ? 'File'
  : stat.isDirectory() ? 'Directory'
  : stat.isSymbolicLink() ? 'SymbolicLink'
  : 'Unsupported'

module.exports = WriteEntry


/***/ }),

/***/ 2224:
/***/ ((module) => {


module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value
    }
  }
}


/***/ }),

/***/ 1590:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = Yallist

Yallist.Node = Node
Yallist.create = Yallist

function Yallist (list) {
  var self = this
  if (!(self instanceof Yallist)) {
    self = new Yallist()
  }

  self.tail = null
  self.head = null
  self.length = 0

  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item)
    })
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i])
    }
  }

  return self
}

Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list')
  }

  var next = node.next
  var prev = node.prev

  if (next) {
    next.prev = prev
  }

  if (prev) {
    prev.next = next
  }

  if (node === this.head) {
    this.head = next
  }
  if (node === this.tail) {
    this.tail = prev
  }

  node.list.length--
  node.next = null
  node.prev = null
  node.list = null

  return next
}

Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var head = this.head
  node.list = this
  node.next = head
  if (head) {
    head.prev = node
  }

  this.head = node
  if (!this.tail) {
    this.tail = node
  }
  this.length++
}

Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var tail = this.tail
  node.list = this
  node.prev = tail
  if (tail) {
    tail.next = node
  }

  this.tail = node
  if (!this.head) {
    this.head = node
  }
  this.length++
}

Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i])
  }
  return this.length
}

Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i])
  }
  return this.length
}

Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined
  }

  var res = this.tail.value
  this.tail = this.tail.prev
  if (this.tail) {
    this.tail.next = null
  } else {
    this.head = null
  }
  this.length--
  return res
}

Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined
  }

  var res = this.head.value
  this.head = this.head.next
  if (this.head) {
    this.head.prev = null
  } else {
    this.tail = null
  }
  this.length--
  return res
}

Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this
  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this)
    walker = walker.next
  }
}

Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this
  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this)
    walker = walker.prev
  }
}

Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.next
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.prev
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this
  var res = new Yallist()
  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this))
    walker = walker.next
  }
  return res
}

Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this
  var res = new Yallist()
  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this))
    walker = walker.prev
  }
  return res
}

Yallist.prototype.reduce = function (fn, initial) {
  var acc
  var walker = this.head
  if (arguments.length > 1) {
    acc = initial
  } else if (this.head) {
    walker = this.head.next
    acc = this.head.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i)
    walker = walker.next
  }

  return acc
}

Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc
  var walker = this.tail
  if (arguments.length > 1) {
    acc = initial
  } else if (this.tail) {
    walker = this.tail.prev
    acc = this.tail.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i)
    walker = walker.prev
  }

  return acc
}

Yallist.prototype.toArray = function () {
  var arr = new Array(this.length)
  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.next
  }
  return arr
}

Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length)
  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.prev
  }
  return arr
}

Yallist.prototype.slice = function (from, to) {
  to = to || this.length
  if (to < 0) {
    to += this.length
  }
  from = from || 0
  if (from < 0) {
    from += this.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > this.length) {
    to = this.length
  }
  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length
  if (to < 0) {
    to += this.length
  }
  from = from || 0
  if (from < 0) {
    from += this.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > this.length) {
    to = this.length
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.splice = function (start, deleteCount, ...nodes) {
  if (start > this.length) {
    start = this.length - 1
  }
  if (start < 0) {
    start = this.length + start;
  }

  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next
  }

  var ret = []
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value)
    walker = this.removeNode(walker)
  }
  if (walker === null) {
    walker = this.tail
  }

  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev
  }

  for (var i = 0; i < nodes.length; i++) {
    walker = insert(this, walker, nodes[i])
  }
  return ret;
}

Yallist.prototype.reverse = function () {
  var head = this.head
  var tail = this.tail
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev
    walker.prev = walker.next
    walker.next = p
  }
  this.head = tail
  this.tail = head
  return this
}

function insert (self, node, value) {
  var inserted = node === self.head ?
    new Node(value, null, node, self) :
    new Node(value, node, node.next, self)

  if (inserted.next === null) {
    self.tail = inserted
  }
  if (inserted.prev === null) {
    self.head = inserted
  }

  self.length++

  return inserted
}

function push (self, item) {
  self.tail = new Node(item, self.tail, null, self)
  if (!self.head) {
    self.head = self.tail
  }
  self.length++
}

function unshift (self, item) {
  self.head = new Node(item, null, self.head, self)
  if (!self.tail) {
    self.tail = self.head
  }
  self.length++
}

function Node (value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list)
  }

  this.list = list
  this.value = value

  if (prev) {
    prev.next = this
    this.prev = prev
  } else {
    this.prev = null
  }

  if (next) {
    next.prev = this
    this.next = next
  } else {
    this.next = null
  }
}

try {
  // add if support for Symbol.iterator is present
  __webpack_require__(2224)(Yallist)
} catch (er) {}


/***/ }),

/***/ 7836:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "downloadTemplate": () => (/* reexport */ downloadTemplate),
  "registryProvider": () => (/* reexport */ registryProvider),
  "startShell": () => (/* reexport */ startShell)
});

// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(3977);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(7561);
// EXTERNAL MODULE: ./node_modules/.pnpm/tar@6.1.15/node_modules/tar/index.js
var tar = __webpack_require__(6620);
// EXTERNAL MODULE: ./node_modules/.pnpm/pathe@1.1.1/node_modules/pathe/dist/shared/pathe.92c04245.mjs
var pathe_92c04245 = __webpack_require__(6146);
// EXTERNAL MODULE: ./node_modules/.pnpm/defu@6.1.2/node_modules/defu/dist/defu.mjs
var defu = __webpack_require__(9071);
// EXTERNAL MODULE: external "node:stream"
var external_node_stream_ = __webpack_require__(4492);
// EXTERNAL MODULE: external "node:child_process"
var external_node_child_process_ = __webpack_require__(7718);
// EXTERNAL MODULE: external "node:os"
var external_node_os_ = __webpack_require__(612);
// EXTERNAL MODULE: external "node:util"
var external_node_util_ = __webpack_require__(7261);
// EXTERNAL MODULE: ./node_modules/.pnpm/node-fetch-native@1.4.0/node_modules/node-fetch-native/dist/index.mjs
var dist = __webpack_require__(2324);
// EXTERNAL MODULE: ./node_modules/.pnpm/https-proxy-agent@5.0.1/node_modules/https-proxy-agent/dist/index.js
var https_proxy_agent_dist = __webpack_require__(6181);
;// CONCATENATED MODULE: ./node_modules/.pnpm/giget@1.1.2/node_modules/giget/dist/shared/giget.093c29e5.mjs












async function download(url, filePath, options = {}) {
  const infoPath = filePath + ".json";
  const info = JSON.parse(
    await (0,promises_.readFile)(infoPath, "utf8").catch(() => "{}")
  );
  const headResponse = await sendFetch(url, {
    method: "HEAD",
    headers: options.headers
  }).catch(() => void 0);
  const etag = headResponse?.headers.get("etag");
  if (info.etag === etag && (0,external_node_fs_.existsSync)(filePath)) {
    return;
  }
  info.etag = etag;
  const response = await sendFetch(url, { headers: options.headers });
  if (response.status >= 400) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`
    );
  }
  const stream = (0,external_node_fs_.createWriteStream)(filePath);
  await (0,external_node_util_.promisify)(external_node_stream_.pipeline)(response.body, stream);
  await (0,promises_.writeFile)(infoPath, JSON.stringify(info), "utf8");
}
const inputRegex = /^(?<repo>[\w.-]+\/[\w.-]+)(?<subdir>[^#]+)?(?<ref>#[\w.-]+)?/;
function parseGitURI(input) {
  const m = input.match(inputRegex)?.groups;
  return {
    repo: m.repo,
    subdir: m.subdir || "/",
    ref: m.ref ? m.ref.slice(1) : "main"
  };
}
function debug(...arguments_) {
  if (process.env.DEBUG) {
    console.debug("[giget]", ...arguments_);
  }
}
async function sendFetch(url, options = {}) {
  if (!options.agent) {
    const proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    if (proxyEnv) {
      options.agent = https_proxy_agent_dist(proxyEnv);
    }
  }
  if (options?.headers) {
    options.headers = normalizeHeaders(options.headers);
  }
  return await (0,dist/* fetch */.he)(url, options);
}
function cacheDirectory() {
  return process.env.XDG_CACHE_HOME ? (0,pathe_92c04245.r)(process.env.XDG_CACHE_HOME, "giget") : (0,pathe_92c04245.r)((0,external_node_os_.homedir)(), ".cache/giget");
}
function normalizeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) {
      continue;
    }
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}
function currentShell() {
  if (process.env.SHELL) {
    return process.env.SHELL;
  }
  if (process.platform === "win32") {
    return "cmd.exe";
  }
  return "/bin/bash";
}
function startShell(cwd) {
  cwd = (0,pathe_92c04245.r)(cwd);
  const shell = currentShell();
  console.info(
    `(experimental) Opening shell in ${(0,pathe_92c04245.b)(process.cwd(), cwd)}...`
  );
  (0,external_node_child_process_.spawnSync)(shell, [], {
    cwd,
    shell: true,
    stdio: "inherit"
  });
}

const github = (input, options) => {
  const parsed = parseGitURI(input);
  const github2 = process.env.GIGET_GITHUB_URL || "https://github.com";
  return {
    name: parsed.repo.replace("/", "-"),
    version: parsed.ref,
    subdir: parsed.subdir,
    headers: {
      authorization: options.auth ? `Bearer ${options.auth}` : void 0
    },
    url: `${github2}/${parsed.repo}/tree/${parsed.ref}${parsed.subdir}`,
    tar: `${github2}/${parsed.repo}/archive/${parsed.ref}.tar.gz`
  };
};
const gitlab = (input, options) => {
  const parsed = parseGitURI(input);
  const gitlab2 = process.env.GIGET_GITLAB_URL || "https://gitlab.com";
  return {
    name: parsed.repo.replace("/", "-"),
    version: parsed.ref,
    subdir: parsed.subdir,
    headers: {
      authorization: options.auth ? `Bearer ${options.auth}` : void 0
    },
    url: `${gitlab2}/${parsed.repo}/tree/${parsed.ref}${parsed.subdir}`,
    tar: `${gitlab2}/${parsed.repo}/-/archive/${parsed.ref}.tar.gz`
  };
};
const bitbucket = (input, options) => {
  const parsed = parseGitURI(input);
  return {
    name: parsed.repo.replace("/", "-"),
    version: parsed.ref,
    subdir: parsed.subdir,
    headers: {
      authorization: options.auth ? `Bearer ${options.auth}` : void 0
    },
    url: `https://bitbucket.com/${parsed.repo}/src/${parsed.ref}${parsed.subdir}`,
    tar: `https://bitbucket.org/${parsed.repo}/get/${parsed.ref}.tar.gz`
  };
};
const sourcehut = (input, options) => {
  const parsed = parseGitURI(input);
  return {
    name: parsed.repo.replace("/", "-"),
    version: parsed.ref,
    subdir: parsed.subdir,
    headers: {
      authorization: options.auth ? `Bearer ${options.auth}` : void 0
    },
    url: `https://git.sr.ht/~${parsed.repo}/tree/${parsed.ref}/item${parsed.subdir}`,
    tar: `https://git.sr.ht/~${parsed.repo}/archive/${parsed.ref}.tar.gz`
  };
};
const providers = {
  github,
  gh: github,
  gitlab,
  bitbucket,
  sourcehut
};

const DEFAULT_REGISTRY = "https://raw.githubusercontent.com/unjs/giget/main/templates";
const registryProvider = (registryEndpoint = DEFAULT_REGISTRY, options) => {
  options = options || {};
  return async (input) => {
    const start = Date.now();
    const registryURL = `${registryEndpoint}/${input}.json`;
    const result = await sendFetch(registryURL, {
      headers: {
        authorization: options.auth ? `Bearer ${options.auth}` : void 0
      }
    });
    if (result.status >= 400) {
      throw new Error(
        `Failed to download ${input} template info from ${registryURL}: ${result.status} ${result.statusText}`
      );
    }
    const info = await result.json();
    if (!info.tar || !info.name) {
      throw new Error(
        `Invalid template info from ${registryURL}. name or tar fields are missing!`
      );
    }
    debug(
      `Fetched ${input} template info from ${registryURL} in ${Date.now() - start}ms`
    );
    return info;
  };
};

const sourceProtoRe = /^([\w-.]+):/;
async function downloadTemplate(input, options = {}) {
  options = (0,defu/* defu */.ob)(
    {
      registry: process.env.GIGET_REGISTRY,
      auth: process.env.GIGET_AUTH
    },
    options
  );
  const registry = options.registry !== false ? registryProvider(options.registry, { auth: options.auth }) : void 0;
  let providerName = options.provider || (registryProvider ? "registry" : "github");
  let source = input;
  const sourceProvierMatch = input.match(sourceProtoRe);
  if (sourceProvierMatch) {
    providerName = sourceProvierMatch[1];
    source = input.slice(sourceProvierMatch[0].length);
  }
  const provider = options.providers?.[providerName] || providers[providerName] || registry;
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }
  const template = await Promise.resolve().then(() => provider(source, { auth: options.auth })).catch((error) => {
    throw new Error(
      `Failed to download template from ${providerName}: ${error.message}`
    );
  });
  template.name = (template.name || "template").replace(/[^\da-z-]/gi, "-");
  template.defaultDir = (template.defaultDir || template.name).replace(
    /[^\da-z-]/gi,
    "-"
  );
  const cwd = (0,pathe_92c04245.r)(options.cwd || ".");
  const extractPath = (0,pathe_92c04245.r)(cwd, options.dir || template.defaultDir);
  if (options.forceClean) {
    await (0,promises_.rm)(extractPath, { recursive: true, force: true });
  }
  if (!options.force && (0,external_node_fs_.existsSync)(extractPath) && (0,external_node_fs_.readdirSync)(extractPath).length > 0) {
    throw new Error(`Destination ${extractPath} already exists.`);
  }
  await (0,promises_.mkdir)(extractPath, { recursive: true });
  const temporaryDirectory = (0,pathe_92c04245.r)(
    cacheDirectory(),
    options.provider,
    template.name
  );
  const tarPath = (0,pathe_92c04245.r)(
    temporaryDirectory,
    (template.version || template.name) + ".tar.gz"
  );
  if (options.preferOffline && (0,external_node_fs_.existsSync)(tarPath)) {
    options.offline = true;
  }
  if (!options.offline) {
    await (0,promises_.mkdir)((0,pathe_92c04245.c)(tarPath), { recursive: true });
    const s2 = Date.now();
    await download(template.tar, tarPath, {
      headers: {
        authorization: options.auth ? `Bearer ${options.auth}` : void 0,
        ...normalizeHeaders(template.headers)
      }
    }).catch((error) => {
      if (!(0,external_node_fs_.existsSync)(tarPath)) {
        throw error;
      }
      debug("Download error. Using cached version:", error);
      options.offline = true;
    });
    debug(`Downloaded ${template.tar} to ${tarPath} in ${Date.now() - s2}ms`);
  }
  if (!(0,external_node_fs_.existsSync)(tarPath)) {
    throw new Error(
      `Tarball not found: ${tarPath} (offline: ${options.offline})`
    );
  }
  const s = Date.now();
  const subdir = template.subdir?.replace(/^\//, "") || "";
  await (0,tar.extract)({
    file: tarPath,
    cwd: extractPath,
    onentry(entry) {
      entry.path = entry.path.split("/").splice(1).join("/");
      if (subdir) {
        if (entry.path.startsWith(subdir + "/")) {
          entry.path = entry.path.slice(subdir.length);
        } else {
          entry.path = "";
        }
      }
    }
  });
  debug(`Extracted to ${extractPath} in ${Date.now() - s}ms`);
  return {
    ...template,
    source,
    dir: extractPath
  };
}



;// CONCATENATED MODULE: ./node_modules/.pnpm/giget@1.1.2/node_modules/giget/dist/index.mjs














/***/ })

};
