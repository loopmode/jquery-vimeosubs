/*globals window, document, console, Froogaloop, $f, swfobject, navigator, jQuery*/ 
(function($){

	
	/*
	 * -----------------------------------------------------------------------------------------------
	 * 
	 * HTML5 VERSION
	 * 
	 * -----------------------------------------------------------------------------------------------
	 */
	
	var urls = {
		froogaloop: 'http://a.vimeocdn.com/js/froogaloop2.min.js',
		swfobject: 'https://ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js',
		htmlstyles: './css/vimeosubs.css'
	};
	 
	var VimeoHtmlSubs = function(iframe, options) {
		this.iframe = iframe; 
		this.options = $.extend({}, {
			scripts: [
				{
					src: urls.froogaloop,
					check: 'Froogaloop'
				}, 
				{
					src: urls.swfobject,
					check: 'swfobject'
				}
			],
			styles: [
			    {
					src: options.css || urls.htmlstyles,
					media: 'screen'
			    }
			],
			textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
		}, options);
		 
		if (!$('head').hasClass('htmlsubs')) {
			$('head').addClass('htmlsubs');
		}
		
		this.loadScripts();
		this.loadStyles();	
	};
	VimeoHtmlSubs.prototype = {
		delegate: function( obj, fn ) {
			return function() { return fn.apply(obj, arguments); };
		},	

		//-------------------------------------------------------------------------------------------
		//
		// EXTERNAL RESOURCES
		//
		//-------------------------------------------------------------------------------------------

		loadStyles: function() {
			$(this.options.styles).each(function(i,s) {
				$(document.createElement('link') ).attr({
			        href: s.src,
			        media: s.media || 'screen',
			        type: 'text/css',
			        rel: 'stylesheet'
			    }).appendTo('head');
			});
		},
		
		loadScripts: function() {
			var scriptCount = 0;
			var self = this;  
			$(this.options.scripts).each(function(i,s) {
				if (!s.hasOwnProperty('check') || !window.hasOwnProperty(s.check)) {				 
					$.getScript(s.src, function() {
						scriptCount++;
						if (scriptCount === self.options.scripts.length) {
							self.scriptsLoaded();
						}
					});
				}
			});
		},

		scriptsLoaded: function() {
			this.createElements();
			Froogaloop(this.iframe).addEvent('ready', this.delegate(this, this.playerReady));
			 
		},

		//-------------------------------------------------------------------------------------------
		//
		// DOM MANIPULATION
		//
		//-------------------------------------------------------------------------------------------

		createElements: function() {
			var i = $(this.iframe);
			var c = this.container = $('<div class="vimeosubs">');
			i.before( c );
			c.width( i.width() );
			c.height( i.height() );
			c.append( i );
			
			c.append($(
				 '<div class="subs">' 
				+'	<div class="text"><span></span></div>'
				+'</div>'
			));
			c.find('.text span').css('text-shadow', this.options.textShadow);
		},
		
		
		//-------------------------------------------------------------------------------------------
		//
		// PLAYER EVENTS
		//
		//-------------------------------------------------------------------------------------------

		playerReady: function(player_id){ 
	        this.froogaloop = $f(player_id); 
	        this.froogaloop.addEvent('playProgress', this.delegate(this, this.onPlayProgress));  
	        this.froogaloop.addEvent('seek', this.delegate(this, this.onSeek));  
			this.loadSrt(); 
			this.loadList();
		}, 

		onPlayProgress: function(data) {
			var self = this;
			
			if (!this.subs) {
				return;
			}
			
			this.froogaloop.api('getCurrentTime', function(value) {
				var line = self.getLineByTime(value);
				self.setCurrentLine(line);
			});
			
			// prevent true fullscreen mode
			if (this.iframe.hasOwnProperty('webkitDisplayingFullscreen') && this.iframe.webkitDisplayingFullscreen) {
				this.iframe.webkitExitFullscreen();
			}
		},
		onSeek: function(data) { 
			var line = this.getLineByTime(data.seconds);
			this.setCurrentLine(line);
		}, 
		//-------------------------------------------------------------------------------------------
		//
		// SRT LOADING AND PARSING
		//
		//-------------------------------------------------------------------------------------------

		loadSrt: function(srt) { 
			if (!srt || srt === 'undefined' || srt === 'null') {
				this.subs = null;
				this.setCurrentLine(null);
				return;
			}
			if (srt || this.options.srt) {
				srt = srt || this.options.srt;
				this.currentSrt = srt;
				$.ajax({
					type: "GET",
					url: srt, 
					success: this.delegate(this, this.srtLoaded)
				});
				this.setCurrentLine(null);
			}
			
		},
		srtLoaded: function(data) {
			this.subs = this.parseSrt(data);
			this.setCurrentLine(null);
		},
		
		/**
		 * Creates an array containing a {id, start, end, text} object for each subtitle line. 
		 */
		parseSrt: function(string) { 
			var result = [];  
			var lines = string.split('\n');
			var errors = [];
			var s;
			var sid;  
			$(lines).each(function(i,l) {
				
				var _is_e = function(_l) { 
					if (!_l) {
						return true;
					}
					if (_l) {
						if (_l.length === 0) {return true;} 
						if (_l === '\\s') {return true;}
						if (_l === '\\r') {return true;}
						if (_l === '\\n') {return true;}
						if (_l === '\\r\\n') {return true;}
						if (_l.toString().trim().length === 0) {return true;}
					} 
				};
				var is_e = _is_e(l);

			 
				// detect first line
				var is_f = !is_e && !isNaN(l) && ( (i===0) || _is_e(lines[i-1]) ) ;
							
				// detect last line			  
				var is_l = is_e && ( i>=lines.length-1 || !isNaN(lines[i+1]) ); 
				//--------------------------------------------------------------
				// id line
				//--------------------------------------------------------------
				if ( is_f ) {
					s = {id: parseInt(l,10), text:''};
					sid = i; 
					//console.log('first line: '+l)
				}
				
				//--------------------------------------------------------------
				// timecode line
				//--------------------------------------------------------------
			 
				if (i === sid+1) {
					if (l.indexOf(' --> ') !== -1) {
						s.start = l.split(' --> ')[0];
						s.end = l.split(' --> ')[1];					
					}
					else {
						errors.push( "Illegal timecode line at "+i+": "+l );
					}
					//console.log('tc line: '+l)
				} 

				//--------------------------------------------------------------
				// text lines
				//--------------------------------------------------------------
				if (i >= sid+2 && !is_l) {
					s.text += l.replace(/\r\n/g, '\n');
					if (!_is_e(lines[i+1])) {
						s.text += '\n';
					}
					//console.log('text line: '+l)
				}
				
				//--------------------------------------------------------------
				// last line
				//--------------------------------------------------------------
				if ( is_l ) { 
					result.push(s);
					//console.log('last line: '+l)
				}
				
			}); 
			if (errors.length > 0) {
				window.alert('errors happened parsing the srt file!');
			}  
			
			return result;
		},
		/**
		 * Takes an srt-formatted timecode and converts it to seconds
		 * @param a string in the format hh:mm:ss,ms
		 * @returns Decimal number of seconds
		 */
		srtTimeToSeconds: function(tc) {
			//00:05:54,880
			var qp = tc.split(':');
			var cp = qp[qp.length-1].split(',');
			var hh = Number(qp[0]);
			var mm = Number(qp[1]);
			var ss = Number(cp[0]);
			var ms = Number(cp[1]);
			var result = ss	+ mm*60	+ hh*3600 + Number('0.'+ms);
			return result;
		
		},
		
		//-------------------------------------------------------------------------------------------
		//
		// XML LIST LOADING AND PARSING
		//
		//-------------------------------------------------------------------------------------------

		loadList: function() { 
			if (this.options.list && this.options.select) {
				$.ajax({
					type: "GET",
					datatype: "xml",
					url: this.options.list, 
					success: this.delegate(this, this.listLoaded)
				});
			}
			
		},
		listLoaded: function(xml) { 
			var list = [{title: 'No subtitles'}]; 
			$(xml).find('srt').each(function(){ 
				list.push({
					lang: $(this).attr('lang'),
					title: $(this).attr('title'),
					file: $(this).text()
				}); 
			});
			this.list = list; 
			this.list.defaultLang = this.options.lang || $(xml).find('subtitles').attr('defaultLang');
			
			this.createSelectBox();
		},
		createSelectBox: function() {
			
			var self = this;
			var select = $(this.options.select);  
			var def;
			
			select.change(function() {
				self.loadSrt(select.find('option:selected').val());
			});
			
			$(this.list).each(function(i, o){
				 select.append($('<option value="'+o.file+'">'+o.title+'</option>'));
				 if (o.lang === self.list.defaultLang) {
					 def = o; 
				 }
			});
			
			if (def) {
				this.loadSrt(def.file);
				select[0].selectedIndex = $.inArray( def, this.list );
			}
		},
		//-------------------------------------------------------------------------------------------
		//
		// SRT DISPLAY
		//
		//-------------------------------------------------------------------------------------------

		getLineByTime: function(time) {
			var self= this;
			var result = null;
			$(this.subs).each(function(i, l) {
				var s_start = self.srtTimeToSeconds( l.start );
				var s_end = self.srtTimeToSeconds( l.end );
				if (time >= s_start && time <= s_end) {
					result = l;
				}
			});
			return result;
		},	

		setCurrentLine: function(line) {  
			if (line === this.currentLine) {
				return;
			}
			this.currentLine = line;
			var t = this.container.find('.text span');
			if (line && line.text) {
				t.html( line.text ); 
				t.show();
			}
			else {
				t.hide();
			}
		} 

	};
	 
	
	/*
	 * -----------------------------------------------------------------------------------------------
	 * 
	 * FLASH VERSION
	 * 
	 * -----------------------------------------------------------------------------------------------
	 */
	
	
	$.fn.vimeosubs = function(options) {
		// define variables
		var iframe, o, src, vimeo_id, query_params, container, 
			swf_id, swf_attributes, swf_params, swf_flashVars, swf_embedHandler;
		 
		// validate iframe element 
		iframe = $(this);
		if (iframe[0].tagName.toLowerCase() !== 'iframe') {
			throw this+' is not an iframe!'; 
		} 

		// apply options
		o = $.extend({}, $.fn.vimeosubs.defaults, options);
		
		// flash/html fork
		var enforceHtml = false;
		$(o.htmlClients).each(function(i,c) {
			if (navigator.userAgent.indexOf(c) !== -1) {
				enforceHtml = true;
			}
		});
		if (enforceHtml) {
			iframe[0].vimeoHtmlSubs = new VimeoHtmlSubs( iframe[0], o );
			return this;
		}
		
		// mark head
		if (!$('head').hasClass('flashsubs')) {
			$('head').addClass('flashsubs');
		}
		
		// remove select box for html version
		if (o.select) {
			$(o.select).remove();
		}
		
		// ensure global players array exists
		if (!$.fn.vimeosubs.hasOwnProperty('flashPlayers')) {
			$.fn.vimeosubs.flashPlayers = [];
		}
		 
		// shortcut to iframe source url
		src = iframe.attr('src');
		
		if (src.indexOf(o.vimeo_player) !== -1) {
			
			/**
			 * Appends a time query param if usecache is set to false in options.
			 */
			var url = function(value) {
				if (o.usecache) {
					return value;
				}
				return value + '?time=' + new Date().getTime();
			};
			
			vimeo_id = src.split(o.vimeo_player)[1].split('?')[0];	
			query_params = src.split('?')[1];
			//------------------------------------------------------------------
			// 
			// create the container div
			//
			//------------------------------------------------------------------
			container = $('<div>').attr({
				id: 'VimeoSrt_'+vimeo_id
			}).css({
				width: iframe.width(),
				height: iframe.height()
			}).insertBefore(iframe);
			
			
			//------------------------------------------------------------------
			// 
			// embed VimeoSrtPlayer.swf
			//
			//------------------------------------------------------------------
			swf_id = 'VimeoSrtPlayer_'+vimeo_id;  
			
			swf_attributes = {
				bgcolor: "#000000",
				id: swf_id,
				name: swf_id,
				allowScriptAccess: "always",
				allowFullScreen: "true"
			}; 
			
			swf_params = {
				wmode: "window"
			};
			
			swf_flashVars = $.extend({}, {
				swfId: swf_id,
				vimeoId: vimeo_id, 
				srt: url(o.srt),
				localization: url(o.list),
				lang: o.lang,
				srtFontSize: o.fontsize,
				srtMargin: o.margin,
				queryParams: window.escape(query_params),
				dynpos: o.dynpos
			}, o);
			
			swf_embedHandler = function(e) {  
				if (e.success) {
					//console.log(vimeo_id+' -> '+$('#'+swf_id)[0]);
					$.fn.vimeosubs.flashPlayers.push($('#'+swf_id)[0]);
				}
				else {
					throw "'"+o.swf+"' not embedded!";
				}
				
			};
			
			var do_embed = function() {
				swfobject.embedSWF(url(o.swf), container.attr('id'), iframe.width(), iframe.height(), o.flashVersion, o.expressInstall, swf_flashVars, swf_params, swf_attributes, swf_embedHandler);
				iframe.attr('src', 'about:blank');
				iframe.remove();
			};
			
			if (window.hasOwnProperty('swfobject')) {
				do_embed();
			}
			else { 
				$.getScript(urls.swfobject, do_embed);
			}
		}
	};
	
	$.fn.vimeosubs.defaults = {
		/** the part of iframe src before the vimeo id appears */ 
		vimeo_player: 'http://player.vimeo.com/video/', 
		
		/** use cached versions of files vs always load fresh */
		usecache: true, 
		
		/** VimeoSrtPlayer swf file */
		swf: 'swf/VimeoSrtPlayer.swf', 
		
		/** an srt file to be loaded on startup */
		srt: '', 
		
		/** an xml file with further srts */
		list: '', 
		
		/** default language code when srtlist is specified */
		lang: '', 
		
		/* subtitle font size in pixels */
		fontsize: 21, 
		
		/** subtitle bottom margin in pixels */
		margin: 30, 
		
		/** expressInstall.swf path or url */
		expressInstall: 'swf/expressInstall.swf',
		
		/** minimum required flash version */
		flashVersion: '9.0.124',
		
		/** whether or not the subtitle position should change when the vimeo UI (playbar) appears/disappears */
		dynpos: true,
		
		/** clients that will be forced to use the html5 player */
		htmlClients: ['iPad', 'iPhone']
		 
	};
	
}(jQuery));
 