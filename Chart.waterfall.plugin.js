(function(){
    var helpers = Chart.helpers;
    helpers.sum = function(array) {
        return array.reduce(function(v1, v2) {
            if (!isNaN(v2)) {
                return v1 + v2;
            }
            return v1;
        }, 0);
    };
    var defaultConfig = {
    	position: 'left',
    	ticks: {
    		callback: Chart.Ticks.formatters.linear
    	}
    };
    var WaterfallScale = Chart.Scale.extend({
        handleTickRangeOptions: function() {
            var me = this;
            var opts = me.options;
            var tickOpts = opts.ticks;

            // If we are forcing it to begin at 0, but 0 will already be rendered on the chart,
            // do nothing since that would make the chart weird. If the user really wants a weird chart
            // axis, they can manually override it
            if (tickOpts.beginAtZero) {
                var minSign = helpers.sign(me.min);
                var maxSign = helpers.sign(me.max);

                if (minSign < 0 && maxSign < 0) {
                    // move the top up to 0
                    me.max = 0;
                } else if (minSign > 0 && maxSign > 0) {
                    // move the bottom down to 0
                    me.min = 0;
                }
            }

            if (tickOpts.min !== undefined) {
                me.min = tickOpts.min;
            } else if (tickOpts.suggestedMin !== undefined) {
                me.min = Math.min(me.min, tickOpts.suggestedMin);
            }

            if (tickOpts.max !== undefined) {
                me.max = tickOpts.max;
            } else if (tickOpts.suggestedMax !== undefined) {
                me.max = Math.max(me.max, tickOpts.suggestedMax);
            }

            if (me.min === me.max) {
                me.max++;

                if (!tickOpts.beginAtZero) {
                    me.min--;
                }
            }
        },
        buildTicks: function() {
            var me = this;
            var opts = me.options;
            var tickOpts = opts.ticks;
            // Figure out what the max number of ticks we can support it is based on the size of
            // the axis area. For now, we say that the minimum tick spacing in pixels must be 50
            // We also limit the maximum number of ticks to 11 which gives a nice 10 squares on
            // the graph. Make sure we always have at least 2 ticks
            var maxTicks = me.getTickLimit();
            maxTicks = Math.max(2, maxTicks);

            var numericGeneratorOptions = {
                maxTicks: maxTicks,
                min: tickOpts.min,
                max: tickOpts.max,
                stepSize: helpers.getValueOrDefault(tickOpts.fixedStepSize, tickOpts.stepSize)
            };
            var ticks = me.ticks = Chart.Ticks.generators.linear(numericGeneratorOptions, me);

            me.handleDirectionalChanges();

            // At this point, we need to update our max and min given the tick values since we have expanded the
            // range of the scale
            me.max = helpers.max(ticks);
            me.min = helpers.min(ticks);

            if (tickOpts.reverse) {
                ticks.reverse();

                me.start = me.max;
                me.end = me.min;
            } else {
                me.start = me.min;
                me.end = me.max;
            }
        },
        convertTicksToLabels: function() {
            var me = this;
            me.ticksAsNumbers = me.ticks.slice();
            me.zeroLineIndex = me.ticks.indexOf(0);

            Chart.Scale.prototype.convertTicksToLabels.call(me);
        },
    	determineDataLimits: function() {
    		var me = this;
    		var opts = me.options;
    		var chart = me.chart;
    		var data = chart.data;
    		var datasets = data.datasets;
    		var isHorizontal = me.isHorizontal();
    		var DEFAULT_MIN = 0;
    		var DEFAULT_MAX = 1;

    		function IDMatches(meta) {
    			return isHorizontal ? meta.xAxisID === me.id : meta.yAxisID === me.id;
    		}

    		// First Calculate the range
    		me.min = null;
    		me.max = null;

            helpers.each(datasets, function(dataset, datasetIndex) {
                var sum = helpers.sum(dataset.data);
                me.min = 0;
                me.max = sum;
            });
    		me.min = isFinite(me.min) ? me.min : DEFAULT_MIN;
    		me.max = isFinite(me.max) ? me.max : DEFAULT_MAX;
    		// Common base implementation to handle ticks.min, ticks.max, ticks.beginAtZero
    		this.handleTickRangeOptions();
    	},
        getTickLimit: function() {
            var maxTicks;
            var me = this;
            var tickOpts = me.options.ticks;

            if (me.isHorizontal()) {
                maxTicks = Math.min(tickOpts.maxTicksLimit ? tickOpts.maxTicksLimit : 11, Math.ceil(me.width / 50));
            } else {
                // The factor of 2 used to scale the font size has been experimentally determined.
                var tickFontSize = helpers.getValueOrDefault(tickOpts.fontSize, Chart.defaults.global.defaultFontSize);
                maxTicks = Math.min(tickOpts.maxTicksLimit ? tickOpts.maxTicksLimit : 11, Math.ceil(me.height / (2 * tickFontSize)));
            }

            return maxTicks;
        },
        // Called after the ticks are built. We need
        handleDirectionalChanges: function() {
            if (!this.isHorizontal()) {
                // We are in a vertical orientation. The top value is the highest. So reverse the array
                this.ticks.reverse();
            }
        },
        getLabelForIndex: function(index, datasetIndex) {
            return +this.getRightValue(this.chart.data.datasets[datasetIndex].data[index]);
        },
        // Utils
        getPixelForValue: function(value) {
            // This must be called after fit has been run so that
            // this.left, this.top, this.right, and this.bottom have been defined
            var me = this;
            var start = me.start;

            var rightValue = +me.getRightValue(value);
            var pixel;
            var range = me.end - start;

            if (me.isHorizontal()) {
                pixel = me.left + (me.width / range * (rightValue - start));
                return Math.round(pixel);
            }

            pixel = me.bottom - (me.height / range * (rightValue - start));
            return Math.round(pixel);
        },
        getValueForPixel: function(pixel) {
            var me = this;
            var isHorizontal = me.isHorizontal();
            var innerDimension = isHorizontal ? me.width : me.height;
            var offset = (isHorizontal ? pixel - me.left : me.bottom - pixel) / innerDimension;
            return me.start + ((me.end - me.start) * offset);
        },
        getPixelForTick: function(index) {
            return this.getPixelForValue(this.ticksAsNumbers[index]);
        }
    });
    Chart.scaleService.registerScaleType('waterfall', WaterfallScale, defaultConfig);

    Chart.defaults.waterfall = {
        hover: {
            mode: 'label'
        },
        scales: {
            xAxes: [{
                type: 'waterfall',
                position: 'bottom'
            }],
            yAxes: [{
                position: 'left',
                type: 'category',

                // Specific to Horizontal Bar Controller
                categoryPercentage: 0.8,
                barPercentage: 0.9,

                // grid line settings
                gridLines: {
                    offsetGridLines: true
                }
            }]
        },
        elements: {
            rectangle: {
                borderSkipped: 'left'
            }
        },
        tooltips: {
            enabled: false
        }
    };

    Chart.controllers.waterfall = Chart.controllers.horizontalBar.extend({
        calculateBarBase: function(datasetIndex, index) {
            var me = this;
            var meta = me.getMeta();
            var xScale = me.getScaleForId(meta.xAxisID);
            var base = xScale.getBaseValue();
            var chart = me.chart;
            var datasets = chart.data.datasets;
            var value = Number(datasets[datasetIndex].data[index]);
            for (var j = 0; j < index; j++){
                base += Number(datasets[datasetIndex].data[j]);
            }
            return xScale.getPixelForValue(base);
        },
        calculateBarX: function(index, datasetIndex) {
            var me = this;
            var meta = me.getMeta();
            var xScale = me.getScaleForId(meta.xAxisID);
            var value = Number(me.getDataset().data[index]);

            var v = xScale.getBaseValue();
            for (var j = 0; j <= index; j++){
                v += Number(me.chart.data.datasets[datasetIndex].data[j]);
            }
            return xScale.getPixelForValue(v);
        }
    });
})();
