/**
* @author: Maarten Brouwers
* @copyright: Public Domain
* @website: https://github.com/murb/geoboundspicker/
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
    this.areas = {};
    this.drawFeature = null;
    this.boundingBox = {
      north: 90,
      east: 180,
      south: -90,
      west: -180,
      isValid: function() {
        return (this.invalidFields().length == 0)
      },
      _isBetween: function(value,min,max) {
        return (value <= max && min <= value)
      },
      _makeBetween: function(value,min,max) {
        if (this._isBetween(value,min,max)) {
          return value;
        } else if (value < min) {
          return min;
        } else {
          return max;
        }
      },
      invalidFields: function() {
        var fields = [];
        if (!this._isBetween(this.north, -90, 90)) fields.push("north"); 
        if (!this._isBetween(this.south, -90, 90)) fields.push("south"); 
        if (!this._isBetween(this.east, -180, 180)) fields.push("east"); 
        if (!this._isBetween(this.west, -180, 180)) fields.push("west"); 
        return fields;
      },
      hasNoValues: function() {
        return ((this.north === null &&
           this.east === null &&
           this.west === null &&
           this.south === null)
            ||
          (typeof this.north === 'undefined' &&
           typeof this.east === 'undefined' &&
           typeof this.west === 'undefined' &&
           typeof this.south === 'undefined'))
      },
      autoCorrectFields: function() {
        this.north = this._makeBetween(this.north, -90,90);
        this.south = this._makeBetween(this.south, -90,90);
        this.east = this._makeBetween(this.east, -180,180);
        this.west = this._makeBetween(this.west, -180,180);
      },
      isEqual: function(that) {
        return (
          (this.north === that.north &&
           this.south === that.south &&
           this.west === that.west &&
           this.east === that.east) 
                   ||
          (this.hasNoValues() && (that === null || that === {}) )
        )
      },
      updateWithOlExtend: function(olExtend) {
        var left = olExtend[0];
        var right = olExtend[2];
        var top = olExtend[3];
        var bottom = olExtend[1];

        if (top > 90) {
          top = 90;
        }
        if (bottom < -90) {
          bottom = -90;
        }

        if (right < left) {
            var l = left;
            left = right;
            right = l;
        }

        if (right - left > 360 ) {
          left = -180;
          right = 180;
        }

        if (right > 180) {
          right = right - 360;
        } else if (right < -180) {
          right = right + 360;
        }
        if (left < -180) {
          left = left + 360;
        } else if (left > 180) {
          left = left - 360;
        }

        if (top < bottom) {
          bottom = olExtend[3];
          top = olExtend[1];
        }

        this.east = right;
        this.west = left;
        this.north = top;
        this.south = bottom;
      }
    }

    this.callback = function() { };

    //some state information
    this.isShowing = false;

    this.settings = {
      projection: 'EPSG:4326',
      map: {
        tile_wms_url: 'https://data.knmi.nl/wms-map/cgi-bin/bgmaps.cgi',
        layers: 'world_baselayer,world_overlay',
      },
      locale: {
        applyLabel: 'Toepassen',
        // cancelLabel: 'Cancel',
        northLabel: 'North',
        southLabel: 'South',
        eastLabel: 'East',
        westLabel: 'West',
        coordinatesLegend: 'Coordinates'
      },
      boundingBox: {},
      areas: [
        {
          label: "Netherlands",
          boundingBox: {
            north: 53.7,
            east: 7.4,
            south: 50.6,
            west: 3.2
          }
        },
        {
          label: "Europe",
          boundingBox: {
            north: 72,
            east: 35,
            south: 34,
            west: -25
          }
        },
        {
          label: "World",
          boundingBox: {
            north: 90,
            east: 180,
            south: -90,
            west: -180
          }
        }
      ],
      includeNone: true,
      noneLabel: 'No geoselection',
      includeCustom: true,
      customLabel: 'Custom',
      opens: 'right',
      drops: 'down'
    }
    
    //custom options from user
    if (typeof options !== 'object' || options === null)
      options = {};

    this.settings = $.extend(this.settings, options);
    this.boundingBox.north = this.settings.boundingBox.north;
    this.boundingBox.south = this.settings.boundingBox.south;
    this.boundingBox.west = this.settings.boundingBox.west;
    this.boundingBox.east = this.settings.boundingBox.east;

    this.template = '<div class="geoboundspicker dropdown-menu">' +
      '<div class="navigation"><ul class="areas"></ul>'+
      '</div>' +
      '<div class="custom"><div class="openlayersmap"></div><form><legend>'+this.settings.locale.coordinatesLegend+'</legend>'+
      '<label class="north"><input name="north" type="number" step="0.1"/><span>'+this.settings.locale.northLabel+'</span></label>'+
      '<label class="west"><input name="west" type="number" step="0.1"/><span>'+this.settings.locale.westLabel+'</span></label>'+
      '<label class="east"><input name="east" type="number" step="0.1"/><span>'+this.settings.locale.eastLabel+'</span></label>'+
      '<label class="south"><input name="south" type="number" step="0.1"/><span>'+this.settings.locale.southLabel+'</span></label></form><div class="buttons">'+
      // '<button class="btn btn-sm cancelBtn">'+this.settings.locale.cancelLabel+'</button> ' +
      '<button class="btn btn-sm applyBtn">'+this.settings.locale.applyLabel+'</button></div></div>' +
      '</div>';

    this.parentEl = (options.parentEl && $(options.parentEl).length) ? $(options.parentEl) : $(this.parentEl);
    this.container = $(this.template).appendTo(this.parentEl);
    this.containerId = this.container.attr("id") || this.container.attr("id","geoboundspicker-"+this.element.offset().top+"-"+this.element.offset().left).attr("id");
    this.olMapId = "geoboundspicker-geoboundsmapid-"+this.element.offset().top+"-"+this.element.offset().left;
    this.container.find(".openlayersmap").attr("id",this.olMapId).css({width: '400px', height: '200px'});
    
    this.initOpenLayers();
    
    this.hideCustom();

    if (typeof cb === 'function') {
        this.callback = cb;
    }

    //
    // event listeners
    //

    this.container
      .on('click.geoboundspicker', 'button.applyBtn', $.proxy(this.clickApply, this))
      .on('click.geoboundspicker', 'li', $.proxy(this.clickArea, this))
      .on('mouseenter.geoboundspicker', 'li', $.proxy(this.hoverArea, this))
      .on('keydown.geoboundspicker', 'li', $.proxy(this.keydownArea, this));

    this.container.find('.custom')
      .on('change.geoboundspicker', 'input', $.proxy(this.coordinateInputFieldChanged, this));

    if (this.element.is('input')) {
      this.element.on({
        'click.geoboundspicker': $.proxy(this.show, this),
        'focus.geoboundspicker': $.proxy(this.show, this),
        'keyup.geoboundspicker': $.proxy(this.elementChanged, this),
        'keydown.geoboundspicker': $.proxy(this.keydown, this)
      });
    } else {
    
      this.element.on({
        'click.geoboundspicker': $.proxy(this.show, this),
        'focus.geoboundspicker': $.proxy(this.show, this),
        'keydown.geoboundspicker': $.proxy(this.keydown, this)
      });
    }
    
    //accessibility aria
    this.element.attr("aria-haspopup",true);
    this.element.attr("aria-owns", this.containerId);
  };

  GeoBoundsPicker.prototype = {
    constructor: GeoBoundsPicker,

    updateView: function() {
      this.updateFormInputs();
    },

    updateFormInputs: function() {
        // this.container.find('button.applyBtn').attr('disabled', 'disabled');
    },
    renderAreas: function() {
      var areasContainer = this.container.find("ul.areas");
      myGeoBoundsPicker = this;
      areasContainer.html("");
      var activeClass = false;
      if (this.settings.includeNone === true) {
        var html = '<li tabindex=0 role="button">'+this.settings.noneLabel+"</li>";
        html = $(html).data("geoboundspicker-area", {showMap: false, boundingBox: {}} );
        if (this.boundingBox.hasNoValues() && activeClass === false) {
          html.addClass("active");
          activeClass = true;
        }
        areasContainer.append(html);
      }
      $(this.settings.areas).each(function(index, listitem) {
        var html = '<li tabindex=0 role="button">'+listitem.label+"</li>";
        html = $(html).data("geoboundspicker-area",listitem);
        if (listitem.boundingBox && myGeoBoundsPicker.boundingBox.isEqual(listitem.boundingBox) && activeClass === false) {
          html.addClass("active"); 
          activeClass = true;
        }

        // if (listitem.showMap === true && activeClass) {
        // }
        areasContainer.append(html);  
      });
      if (this.settings.includeCustom === true) {
        var html = '<li tabindex=0 role="button">'+this.settings.customLabel+"</li>";
        html = $(html).data("geoboundspicker-area", {showMap: true} );
        if (activeClass === false) {
          html.addClass("active");
          myGeoBoundsPicker.showCustom();
          activeClass = true;
        }
        areasContainer.append(html);
      }
      
    },
    initOpenLayers: function() {
      this.drawSource = new ol.source.Vector();
      this.vectorLayer = new ol.layer.Vector({
        source : this.drawSource,
        style : new ol.style.Style({
          fill : new ol.style.Fill({
            color : 'rgba(255, 255, 255, 0.5)'
          }),
          stroke : new ol.style.Stroke({
            color : '#ffcc33',
            width : 2
          }),
          image : new ol.style.Circle({
            radius : 7,
            fill : new ol.style.Fill({
              color : '#ffcc33'
            })
          })
        })
      });
      
      this.olMap = new ol.Map({
        /*
         * The View is basically default zoom level, center point, etc.
         */
        view : new ol.View({
          center : [ 5.178291, 52.099233 ],
          zoom : 4,
          minZoom : 0,
          extent : [ -180, -90, 180, 90 ],
          projection : this.settings.projection
        }),
        /*
         * The Layers are layers in the map. Layers here are a WMS layer
         * and a layer for the drawings.
         */
        layers : [ 
          new ol.layer.Tile({
            source : new ol.source.TileWMS({
              url : this.settings.map.tile_wms_url,
              params : {
                LAYERS: this.settings.map.layers
              }
            })
          })
        ],
        controls: ol.control.defaults({
          attributionOptions: {
            collapsible: false
          }
        }),
        target : this.olMapId
      });

      this.olMap.addLayer(this.vectorLayer);
    
      var thisOlMap = this;
        // Adding the draw functionality.
      var geometryFunction = function(coordinates, geometry) {
        if (!geometry) {
          geometry = new ol.geom.Polygon(null);
        }
        var start = coordinates[0];
        var end = coordinates[1];
        geometry.setCoordinates([ [ start, [ start[0], end[1] ], end,
          [ end[0], start[1] ], start ] ]);
        return geometry;
      };

      /* Adding the drawing interaction to the map. */
      this.drawFeature = new ol.interaction.Draw({
        source : this.drawSource,
        type : "LineString",
        geometryFunction : geometryFunction,
        maxPoints : 2,
        clickTolerance: 20
      })

      this.olMap.addInteraction(this.drawFeature);
      this.olMap.boxlayer = this.drawFeature;
      this.drawFeature.on('drawstart', function(e) {
        thisOlMap.drawSource.clear();
      });

      this.drawFeature.on('drawend', function(e) {
        var extent = e.feature.getGeometry().getExtent();

        // not ideal, but didn't manage to clear the 
        // drawed drawing on drawend.
        e.feature.setStyle(new ol.style.Style({
          zIndex: -100
        }));

        thisOlMap.boundingBox.updateWithOlExtend(extent);
        thisOlMap.drawBoundingBox();
        thisOlMap.updateCoordinateInputFields();
        thisOlMap.renderAreas();
        thisOlMap.formInputsChanged();
          
      });
    },
    describe: function() {
      var myGeoBoundsPicker = this;
      var description = this.settings.customLabel;
      if (this.settings.includeNone && myGeoBoundsPicker.boundingBox.hasNoValues()) {
        description = this.settings.noneLabel;
      };
      $(this.settings.areas).each(function(index, listitem) {
        if (listitem.boundingBox && myGeoBoundsPicker.boundingBox.isEqual(listitem.boundingBox)) {
          description = listitem.label;
        }
      });
      return description;
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

      if (this.settings.opens == 'left') {
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
      } else if (this.settings.opens == 'center') {
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
          .on('touchend.geoboundspicker', this._outsideClickProxy)
          .on('click.geoboundspicker', '[data-toggle=dropdown]', this._outsideClickProxy)
          .on('focusin.geoboundspicker', this._outsideClickProxy);

        // Reposition the picker if the window is resized while it's open
        $(window).on('resize.geoboundspicker', $.proxy(function(e) { this.move(e); }, this));

        this.updateView();
        this.container.show();
        this.move();
        this.element.trigger('show.geoboundspicker', this);
        this.renderAreas();
        
        this.isShowing = true;
    },

    hide: function(e) {
        if (!this.isShowing) return;

        //if picker is attached to a text input, update it

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
      this.updateElement();
      
      this.hideCustom();
      this.hide();
      this.callback(e);
      this.element.trigger('apply.geoboundspicker', this);
    },

    formInputsChanged: function(e) {
      this.renderAreas();
    },

    elementChanged: function(e) {
        if (!this.element.is('input')) return;
        if (!this.element.val().length) return;

        this.updateView();
    },
    
    handleArrowKeys: function(e) {
    
      if ($(this.container).find("li:focus").length === 0) {
        $(this.container).find("li.active").focus();
      } else {
        if (e.keyCode === 38) {
          $(this.container).find("li:focus").prev().focus();
        } else if (e.keyCode === 40) {
          $(this.container).find("li:focus").next().focus();
        }
      }
    },

    keydown: function(e) {
        //hide on tab or enter
      if ([38,40].lastIndexOf(e.keyCode) >= 0) this.handleArrowKeys(e);
      if (e.keyCode === 9) this.hide();
      if (e.keyCode === 13) this.toggle();
    },
    
    keydownArea: function(e) {
      if ([38,40].lastIndexOf(e.keyCode) >= 0) this.handleArrowKeys(e);
      if ((e.keyCode === 13) || e.keyCode === 32) {
          this.clickArea(e);
      }
    },

    updateElement: function() {
        this.element.trigger('change');
    },

    remove: function() {
        this.container.remove();
        this.element.off('.geoboundspicker');
        this.element.removeData();
    },
    
    hoverArea: function(e) {
      
    },
    
    updateCoordinates: function(boundingBox) {
      this.boundingBox.north = boundingBox.north;
      this.boundingBox.east = boundingBox.east;
      this.boundingBox.south = boundingBox.south;
      this.boundingBox.west = boundingBox.west;
    },
    
    updateCoordinateInputFields: function() {
      this.container.find("input[name='north']").val(Math.round(this.boundingBox.north*10)/10.0);
      this.container.find("input[name='east']").val(Math.round(this.boundingBox.east*10)/10.0);
      this.container.find("input[name='south']").val(Math.round(this.boundingBox.south*10)/10.0);
      this.container.find("input[name='west']").val(Math.round(this.boundingBox.west*10)/10.0);
    },
    
    updateCoordinateFromInputField: function(bound) {
      this.boundingBox[bound] = parseFloat(this.container.find("input[name='"+bound+"']").val());
      this.formInputsChanged();
    },
    
    updateCoordinatesFromInputFields: function() {
      this.updateCoordinateFromInputField("north");
      this.updateCoordinateFromInputField("east");
      this.updateCoordinateFromInputField("south");
      this.updateCoordinateFromInputField("west");
      this.autoCorrectFields();
    },
    autoCorrectFields: function() {
      this.boundingBox.autoCorrectFields();
      this.updateCoordinateInputFields();
    },
    validateInputFields: function() {
      var container = this.container;
      this.container.find("input").removeClass("error");
      if (!this.boundingBox.isValid()) {
        $(this.boundingBox.invalidFields()).each(function(index,field){
          container.find("input[name='"+field+"']").addClass("error")
        });
      }
    },
    clickArea: function(e) {
      var boundingBoxAreaData = $(e.target).data("geoboundspicker-area");
      if (typeof boundingBoxAreaData.boundingBox === 'object') {
        this.updateCoordinates(boundingBoxAreaData.boundingBox);
        this.updateCoordinateInputFields(boundingBoxAreaData.boundingBox);
      }
      if (boundingBoxAreaData.showMap) {
        this.showCustom();
      } else {
        this.clickApply();
      }
    },
    
    showCustom: function() {
      this.container.find(".custom").show();
      this.container.find(".custom").attr("aria-expanded", true); 
      this.olMap.updateSize();
      this.drawBoundingBox();
      this.updateCoordinateInputFields();
    },
    
    hideCustom: function() {
      this.container.find(".custom").hide();
      this.container.find(".custom").attr("aria-expanded", false); 
    },
    coordinateInputFieldChanged: function(event) {
      var fieldName = event.target.name;
      var oldValue = this.boundingBox[fieldName];
      this.updateCoordinateFromInputField(fieldName);
      this.autoCorrectFields();
      // this.updateCoordinatesFromInputFields();
      this.drawBoundingBox();
    },
    drawBoundingBox: function() {
      if (this.boundingBox.isValid()) {
      
        this.drawSource.clear();
    
        var east,north,west,south;

        east = this.boundingBox.east;
        north = this.boundingBox.north;
        west = this.boundingBox.west;
        south = this.boundingBox.south;
    
        if (east < west){
          east = east+360;
        }

        var ring = [
          [ east,north ],
          [ west,north ],
          [ west,south ],
          [ east,south ],
          [ east,north ]
        ];
    
        var polygon = new ol.geom.Polygon([ ring ]);

        var feature = new ol.Feature(polygon);

        // Create vector source and the feature to it.
        this.drawSource.addFeature(feature);

        /* Make the bouding box fit perfectly in the map. */
        var extent = ol.extent.boundingExtent(ring);
        this.olMap.getView().fit(extent, this.olMap.getSize());      	

      }
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

