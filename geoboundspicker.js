/**
* @version: 2.1.13
* @author: Dan Grossman http://www.dangrossman.info/
* @copyright: Copyright (c) 2012-2015 Dan Grossman. All rights reserved.
* @license: Licensed under the MIT license. See http://www.opensource.org/licenses/mit-license.php
* @website: https://www.improvely.com/
*/

(function(root, factory) {

  if (typeof define === 'function' && define.amd) {
    define(['jquery', 'exports', 'openlayers'], function($, exports) {
      root.geoboundspicker = factory(root, exports, $);
    });

  } else if (typeof exports !== 'undefined') {
      var jQuery = (typeof window != 'undefined') ? window.jQuery : undefined;  //isomorphic issue
      if (!jQuery) {
          try {
              jQuery = require('jquery');
              if (!jQuery.fn) jQuery.fn = {}; //isomorphic issue
          } catch (err) {
              if (!jQuery) throw new Error('jQuery dependency not found');
          }
      }

    factory(root, exports, ol, jQuery);

  // Finally, as a browser global.
  } else {
    root.geoboundspicker = factory(root, {}, ol, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this || {}, function(root, geoboundspicker, ol, $) { // 'this' doesn't exist on a server

    var GeoBoundsPicker = function(element, options, cb) {

        //default settings for options
        this.parentEl = 'body';
        this.element = $(element);
        this.ranges = {};

        this.opens = 'right';
        if (this.element.hasClass('pull-right'))
            this.opens = 'left';

        this.drops = 'down';
        if (this.element.hasClass('dropup'))
            this.drops = 'up';

        this.buttonClasses = 'btn btn-sm';
        this.applyClass = 'btn-success';
        this.cancelClass = 'btn-default';

        this.callback = function() { };

        //some state information
        this.isShowing = false;
        this.leftCalendar = {};
        this.rightCalendar = {};

        //custom options from user
        if (typeof options !== 'object' || options === null)
            options = {};

        //allow setting options with data attributes
        //data-api options will be overwritten with custom javascript options
        options = $.extend(this.element.data(), options);

        //html template for the picker UI
        if (typeof options.template !== 'string')
            options.template = '<div class="geoboundspicker dropdown-menu">' +
            '<div class="ranges"><ul><li data-value="NONE">Geen beperking op gebied</li><li data-value="NL">Nederland</li><li data-value="EU">Europa</li><li data-value="WRLD">Wereld</li><li data-value="CUSTOM">Aangepast</li></ul></div>' +
            '<div class="openlayersmap"></div>' +
            '</div>';

        this.parentEl = (options.parentEl && $(options.parentEl).length) ? $(options.parentEl) : $(this.parentEl);
        this.container = $(options.template).appendTo(this.parentEl);
        this.olMapId = "geoboundsmapid-"+$('.geoboundspicker').length;
        this.container.find(".openlayersmap").attr("id",this.olMapId).css({width: '400px', height: '200px'});
        
        
        // init ol
        
        this.olMap = new ol.Map({
          target: this.olMapId,
          layers : [ 
              new ol.layer.Tile({
                  source : new ol.source.TileWMS({
                      url : "https://data.knmi.nl/wms-map/cgi-bin/bgmaps.cgi",
                      params : {
                          'LAYERS' : "world_baselayer,world_overlay"
                      }
                  })
              })
          ],
          view: new ol.View({
            center: ol.proj.fromLonLat([37.41, 8.82]),
            zoom: 4
          })
        });

        var container = this.container;
        var element = this.element;
        
        this.container.find("#"+this.olMapId).hide();
        this.container.find("li[data-value='CUSTOM']").click(function(e) {
           //var container = $(e.target).parents(".dropdown-menu");

           container.find(".openlayersmap").show();
           element.text("Aangepast");
        });
        this.container.find("li[data-value='NL'], li[data-value='EU'], li[data-value='WRLD'], li[data-value='NONE']").click(function(e) {
           //var container = $(e.target).parents(".dropdown-menu");
          
           container.find(".openlayersmap").hide();
            container.hide();
                       element.text($(e.target).text());
        });
        

        //
        // handle all the possible options overriding defaults
        //

        if (typeof options.applyClass === 'string')
            this.applyClass = options.applyClass;

        if (typeof options.cancelClass === 'string')
            this.cancelClass = options.cancelClass;

        if (typeof options.opens === 'string')
            this.opens = options.opens;

        if (typeof options.drops === 'string')
            this.drops = options.drops;

        if (typeof options.buttonClasses === 'string')
            this.buttonClasses = options.buttonClasses;

        if (typeof options.buttonClasses === 'object')
            this.buttonClasses = options.buttonClasses.join(' ');

        if (typeof options.autoApply === 'boolean')
            this.autoApply = options.autoApply;

        if (typeof options.autoUpdateInput === 'boolean')
            this.autoUpdateInput = options.autoUpdateInput;



        if (typeof cb === 'function') {
            this.callback = cb;
        }

        if (this.autoApply && typeof options.ranges !== 'object') {
        } else if (this.autoApply) {
            this.container.find('.applyBtn, .cancelBtn').addClass('hide');
        }

        this.container.addClass('opens' + this.opens);

        //apply CSS classes and labels to buttons
        this.container.find('.applyBtn, .cancelBtn').addClass(this.buttonClasses);
        if (this.applyClass.length)
            this.container.find('.applyBtn').addClass(this.applyClass);
        if (this.cancelClass.length)
            this.container.find('.cancelBtn').addClass(this.cancelClass);

        //
        // event listeners
        //

        if (this.element.is('input')) {
            this.element.on({
                'click.geoboundspicker': $.proxy(this.show, this),
                'focus.geoboundspicker': $.proxy(this.show, this),
                'keyup.geoboundspicker': $.proxy(this.elementChanged, this),
                'keydown.geoboundspicker': $.proxy(this.keydown, this)
            });
        } else {
            this.element.on('click.geoboundspicker', $.proxy(this.toggle, this));
        }
    };

    GeoBoundsPicker.prototype = {

        constructor: GeoBoundsPicker,

        updateView: function() {
            this.updateFormInputs();
        },

        updateFormInputs: function() {

            this.container.find('button.applyBtn').attr('disabled', 'disabled');

        },

        move: function() {
            var parentOffset = { top: 0, left: 0 },
                containerTop;
            var parentRightEdge = $(window).width();
            if (!this.parentEl.is('body')) {
                parentOffset = {
                    top: this.parentEl.offset().top - this.parentEl.scrollTop(),
                    left: this.parentEl.offset().left - this.parentEl.scrollLeft()
                };
                parentRightEdge = this.parentEl[0].clientWidth + this.parentEl.offset().left;
            }

            if (this.drops == 'up')
                containerTop = this.element.offset().top - this.container.outerHeight() - parentOffset.top;
            else
                containerTop = this.element.offset().top + this.element.outerHeight() - parentOffset.top;
            this.container[this.drops == 'up' ? 'addClass' : 'removeClass']('dropup');

            if (this.opens == 'left') {
                this.container.css({
                    top: containerTop,
                    right: parentRightEdge - this.element.offset().left - this.element.outerWidth(),
                    left: 'auto'
                });
                if (this.container.offset().left < 0) {
                    this.container.css({
                        right: 'auto',
                        left: 9
                    });
                }
            } else if (this.opens == 'center') {
                this.container.css({
                    top: containerTop,
                    left: this.element.offset().left - parentOffset.left + this.element.outerWidth() / 2
                            - this.container.outerWidth() / 2,
                    right: 'auto'
                });
                if (this.container.offset().left < 0) {
                    this.container.css({
                        right: 'auto',
                        left: 9
                    });
                }
            } else {
                this.container.css({
                    top: containerTop,
                    left: this.element.offset().left - parentOffset.left,
                    right: 'auto'
                });
                if (this.container.offset().left + this.container.outerWidth() > $(window).width()) {
                    this.container.css({
                        left: 'auto',
                        right: 0
                    });
                }
            }
        },

        show: function(e) {
            if (this.isShowing) return;

            // Create a click proxy that is private to this instance of datepicker, for unbinding
            this._outsideClickProxy = $.proxy(function(e) { this.outsideClick(e); }, this);

            // Bind global datepicker mousedown for hiding and
            $(document)
              .on('mousedown.geoboundspicker', this._outsideClickProxy)
              // also support mobile devices
              .on('touchend.geoboundspicker', this._outsideClickProxy)
              // also explicitly play nice with Bootstrap dropdowns, which stopPropagation when clicking them
              .on('click.geoboundspicker', '[data-toggle=dropdown]', this._outsideClickProxy)
              // and also close when focus changes to outside the picker (eg. tabbing between controls)
              .on('focusin.geoboundspicker', this._outsideClickProxy);

            // Reposition the picker if the window is resized while it's open
            $(window).on('resize.geoboundspicker', $.proxy(function(e) { this.move(e); }, this));


            this.updateView();
            this.container.show();
            this.move();
            this.element.trigger('show.geoboundspicker', this);
            this.isShowing = true;
        },

        hide: function(e) {
            if (!this.isShowing) return;

            //if picker is attached to a text input, update it
            this.updateElement();

            $(document).off('.geoboundspicker');
            $(window).off('.geoboundspicker');
            this.container.hide();
            this.element.trigger('hide.geoboundspicker', this);
            this.isShowing = false;
        },

        toggle: function(e) {
            if (this.isShowing) {
                this.hide();
            } else {
                this.show();
            }
        },

        outsideClick: function(e) {
            var target = $(e.target);
            // if the page is clicked anywhere except within the daterangerpicker/button
            // itself then call this.hide()
            if (
                // ie modal dialog fix
                e.type == "focusin" ||
                target.closest(this.element).length ||
                target.closest(this.container).length
                ) return;
            this.hide();
        },

        clickApply: function(e) {
            this.hide();
            this.element.trigger('apply.geoboundspicker', this);
        },

        clickCancel: function(e) {
            this.hide();
            this.element.trigger('cancel.geoboundspicker', this);
        },


        formInputsChanged: function(e) {

        },

        elementChanged: function() {
            if (!this.element.is('input')) return;
            if (!this.element.val().length) return;

            this.updateView();
        },

        keydown: function(e) {
            //hide on tab or enter
            if ((e.keyCode === 9) || (e.keyCode === 13)) {
                this.hide();
            }
        },

        updateElement: function() {
            this.element.trigger('change');
        },

        remove: function() {
            this.container.remove();
            this.element.off('.geoboundspicker');
            this.element.removeData();
        }

    };

    $.fn.geoboundspicker = function(options, callback) {
        this.each(function() {
            var el = $(this);
            if (el.data('geoboundspicker'))
                el.data('geoboundspicker').remove();
            el.data('geoboundspicker', new GeoBoundsPicker(el, options, callback));
        });
        return this;
    };

}));
