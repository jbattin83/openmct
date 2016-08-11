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
        './modes/FollowMode'
    ],
    function (FixedMode, FollowMode) {

        function TimeConductorViewService(conductor, timeSystems) {
            timeSystems = timeSystems.map(function (timeSystemConstructor){
                return timeSystemConstructor();
            });

            this._conductor = conductor;
            this._mode = undefined;
            this._availableModes = {
                'fixed': {
                    implementation: FixedMode,
                    cssclass: 'icon-calendar',
                    label: 'Fixed',
                    name: 'Fixed Timespan Mode',
                    description: 'Query and explore data that falls between two fixed datetimes.'
                }
            };

            function timeSystemsForSourceType(sourceType) {
                return timeSystems.filter(function (timeSystem){
                    return timeSystem.tickSources().some(function (tickSource){
                        return tickSource.type() === sourceType;
                    });
                });
            }

            //Only show 'real-time mode' if a clock source is available
            if (timeSystemsForSourceType('clock').length > 0 ) {
                this._availableModes['realtime'] = {
                    implementation: FollowMode,
                    cssclass: 'icon-clock',
                    label: 'Real-time',
                    name: 'Real-time Mode',
                    tickSourceType: 'clock',
                    description: 'Monitor real-time streaming data as it comes in. The Time Conductor and displays will automatically advance themselves based on a UTC clock.'
                };
            }

            //Only show 'real-time mode' if a clock source is available
            if (timeSystemsForSourceType('data').length > 0) {
                this._availableModes['latest'] = {
                    implementation: FollowMode,
                    cssclass: 'icon-database',
                    label: 'LAD',
                    name: 'LAD Mode',
                    tickSourceType: 'data',
                    description: 'Latest Available Data mode monitors real-time streaming data as it comes in. The Time Conductor and displays will only advance when data becomes available.'
                };
            }
        }

        TimeConductorViewService.prototype.mode = function (mode) {
            if (arguments.length === 1) {
                this._mode = mode;
            }
            return this._mode;
        };

        TimeConductorViewService.prototype.availableModes = function () {
            return this._availableModes;
        };

        return TimeConductorViewService;
    }
);
