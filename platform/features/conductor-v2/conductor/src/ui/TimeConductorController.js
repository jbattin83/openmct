/*****************************************************************************
 * Open MCT Web, Copyright (c) 2014-2015, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT Web is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT Web includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

define(
    [
        './modes/FixedMode',
        './modes/FollowMode',
        './TimeConductorValidation'
    ],
    function (FixedMode, FollowMode, TimeConductorValidation) {

        function TimeConductorController($scope, timeConductor, conductorViewService, timeSystems) {

            var self = this;

            //Bind all class functions to 'this'
            Object.keys(TimeConductorController.prototype).filter(function (key) {
                return typeof TimeConductorController.prototype[key] === 'function';
            }).forEach(function (key) {
                self[key] = self[key].bind(self);
            });

            this.conductorViewService = conductorViewService;
            this.conductor = timeConductor;

            // Construct the provided time system definitions
            this._timeSystems = timeSystems.map(function (timeSystemConstructor){
                return timeSystemConstructor();
            });

            this.modes = conductorViewService.availableModes();

            this.validation = new TimeConductorValidation(this.conductor);
            this.$scope = $scope;

            this.initializeForm();

            this.conductor.on('bounds', this.setFormFromBounds);
            this.conductor.on('follow', function (follow){
                $scope.followMode = follow;
            });
        }

        TimeConductorController.prototype.initializeForm = function() {
            /*
             Set time Conductor bounds in the form
             */
            this.$scope.boundsModel = this.conductor.bounds();

            //If conductor has a time system selected already, populate the
            // form from it
            this.$scope.timeSystemModel = {};
            if (this.conductor.timeSystem()) {
                this.setFormFromTimeSystem(this.conductor.timeSystem());
            }

            /*
             Represents the various modes, and the currently
             selected mode in the view
             */
            this.$scope.modeModel = {
                options: this.conductorViewService.availableModes()
            };

            var mode = this.conductorViewService.mode();
            if (mode) {
                //If view already defines a mode (eg. controller is being
                // initialized after navigation), then pre-populate form
                this.setFormFromMode(mode);
                var deltas = mode.deltas && mode.deltas();
                if (deltas) {
                    this.setFormFromDeltas(deltas);
                }

            } else {
                // Default to fixed mode
                this.setMode('fixed');
            }

            this.setFormFromBounds(this.conductor.bounds());

            this.$scope.$watch('modeModel.selectedKey', this.setMode);
            this.$scope.$watch('timeSystem', this.setTimeSystem);
        };

        /**
         * Called when the bounds change in the time conductor. Synchronizes
         * the bounds values in the time conductor with those in the form
         * @param bounds
         */
        TimeConductorController.prototype.setFormFromBounds = function (bounds) {
            this.$scope.boundsModel.start = bounds.start;
            this.$scope.boundsModel.end = bounds.end;
            if (!this.pendingUpdate) {
                this.pendingUpdate = true;
                requestAnimationFrame(function () {
                    this.pendingUpdate = false;
                    this.$scope.$digest();
                }.bind(this));
            }
        };

        TimeConductorController.prototype.setFormFromMode = function (mode) {
            this.$scope.modeModel.selectedKey = mode.key();
            //Synchronize scope with time system on mode
            this.$scope.timeSystemModel.options = mode.availableTimeSystems().map(function (t) {
                return t.metadata;
            });
        };

        /**
         * @private
         */
        TimeConductorController.prototype.setFormFromDeltas = function (deltas) {
            /*
             * If the selected mode defines deltas, set them in the form
             */
            if (deltas !== undefined) {
                this.$scope.boundsModel.startDelta = deltas.start;
                this.$scope.boundsModel.endDelta = deltas.end;
            } else {
                this.$scope.boundsModel.startDelta = 0;
                this.$scope.boundsModel.endDelta = 0;
            }
        };

        TimeConductorController.prototype.setFormFromTimeSystem = function (timeSystem) {
            this.$scope.timeSystemModel.selected = timeSystem;
            this.$scope.timeSystemModel.format = timeSystem.formats()[0];
            this.$scope.timeSystemModel.deltaFormat = timeSystem.deltaFormat();
        };


        /**
         * Called when form values are changed. Synchronizes the form with
         * the time conductor
         * @param formModel
         */
        TimeConductorController.prototype.updateBoundsFromForm = function (boundsModel) {
            var newBounds = {
                start: boundsModel.start,
                end: boundsModel.end
            };

            if (this.conductor.validateBounds(newBounds) === true) {
                this.conductor.bounds(newBounds);
            }
        };

        /**
         * Called when the delta values in the form change. Validates and
         * sets the new deltas on the Mode.
         * @param boundsModel
         * @see TimeConductorMode
         */
        TimeConductorController.prototype.updateDeltasFromForm = function (boundsModel) {
            var mode = this.conductorViewService.mode(),
                deltas = mode.deltas();

            if (deltas !== undefined && this.validation.validateDeltas(boundsModel.startDelta, boundsModel.endDelta)) {
                //Sychronize deltas between form and mode
                mode.deltas({start: parseFloat(boundsModel.startDelta), end: parseFloat(boundsModel.endDelta)});
            }
        };

        TimeConductorController.prototype.selectTickSource = function (timeSystem, sourceType) {
            return timeSystem.tickSources().filter(function (source){
                return source.type() === sourceType;
            })[0];
        };

        /**
         * Change the selected Time Conductor mode. This will call destroy
         * and initialization functions on the relevant modes, setting
         * default values for bound and deltas in the form.
         * @param newModeKey
         * @param oldModeKey
         */
        TimeConductorController.prototype.setMode = function (newModeKey, oldModeKey) {
            if (newModeKey !== oldModeKey) {
                var newMode = undefined;
                var timeSystem = this.conductor.timeSystem();
                var modes = this.conductorViewService.availableModes();
                var tickSourceType = modes[newModeKey].tickSourceType;

                if (this.conductorViewService.mode()) {
                    this.conductorViewService.mode().destroy();
                }

                function contains(timeSystems, timeSystem) {
                    return timeSystems.find(function (t) {
                        return t.metadata.key === timeSystem.metadata.key;
                    }) !== undefined;
                }

                switch (newModeKey) {
                    case 'fixed':
                        newMode = new FixedMode(newModeKey, this.conductor, this._timeSystems);
                        if (!timeSystem){
                            timeSystem = newMode.availableTimeSystems()[0];
                        }
                        break;
                    case 'realtime':
                    case 'latest':
                        newMode = new FollowMode(newModeKey, this.conductor, this._timeSystems);
                        //Use current conductor time system if supported by
                        // new mode, otherwise use first available time system
                        if (!contains(newMode.availableTimeSystems(), timeSystem)) {
                            timeSystem = newMode.availableTimeSystems()[0];
                        }
                        newMode.tickSource(this.selectTickSource(timeSystem, tickSourceType));
                        break;
                }
                newMode.initialize();
                newMode.changeTimeSystem(timeSystem);

                this.conductorViewService.mode(newMode);

                this.setFormFromMode(newMode);
                this.setFormFromDeltas((timeSystem.defaults() || {}).deltas);
                this.setTimeSystem(timeSystem);
            }
        };

        /**
         * Allows time system to be changed by key. This supports selection
         * from the menu. Resolves a TimeSystem object and then invokes
         * TimeConductorController#setTimeSystem
         * @param key
         * @see TimeConductorController#setTimeSystem
         */
        TimeConductorController.prototype.selectTimeSystemByKey = function(key){
            var selected = this._timeSystems.find(function (timeSystem){
                return timeSystem.metadata.key === key;
            });
            this.setTimeSystem(selected);
        };
        
        /**
         * Sets the selected time system. Will populate form with the default
         * bounds and deltas defined in the selected time system.
         * @param newTimeSystem
         */
        TimeConductorController.prototype.setTimeSystem = function (newTimeSystem) {
            if (newTimeSystem && newTimeSystem !== this.$scope.timeSystemModel.selected) {
                var modes = this.conductorViewService.availableModes();
                var mode = this.conductorViewService.mode();
                mode.changeTimeSystem(newTimeSystem);
                this.setFormFromDeltas((newTimeSystem.defaults() || {}).deltas);

                // If current mode supports ticking, set an appropriate tick
                // source from the new time system
                if (mode.tickSource) {
                    var tickSourceType = modes[mode.key()].tickSourceType;
                    mode.tickSource(this.selectTickSource(newTimeSystem, tickSourceType));
                }

                this.setFormFromTimeSystem(newTimeSystem);
            }
        };

        return TimeConductorController;
    }
);
