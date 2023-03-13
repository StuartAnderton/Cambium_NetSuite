/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

// Checks that Kits have the same status as the least "available" member item


define(['N/record', 'N/runtime', 'N/format'],
    function(record, runtime, format) {
        function onAction(scriptContext) {

            var fromSearch = scriptContext.newRecord;

            log.debug('Loading', fromSearch);

            var kitName = fromSearch.getValue({
                fieldId: 'itemid'
            });

            var kitId = fromSearch.getValue({
                fieldId: 'internalid'
            });

            var startingKitStatus = fromSearch.getValue({
                fieldId: 'custitem_bb1_item_status'
            });

            log.debug('Starting', [kitName, startingKitStatus, getBadness(startingKitStatus)]);

            var memberCount = fromSearch.getLineCount({
                sublistId: 'member'
            });

            var counter = 0;

            //reset to Available as starting position
            var kitStatus = 0;

            while (counter < memberCount) {

                var memberItemId = fromSearch.getSublistValue({
                    sublistId: 'member',
                    fieldId: 'item',
                    line: counter
                });

                var memberItem =  record.load({
                    type: record.Type.INVENTORY_ITEM,
                    id: memberItemId,
                    isDynamic: false
                });

                var memberItemStatus = memberItem.getValue({
                    fieldId: 'custitem_bb1_item_status'
                });

                log.debug('Processing', 'Row ' + counter + ' member status ' + memberItemStatus + '(' + getBadness(memberItemStatus)+ ')');

                if (memberItemStatus > kitStatus) {
                    kitStatus = memberItemStatus;
                }

                counter = counter + 1;
            }

            // Check if update needed
            if (kitStatus != startingKitStatus ) {

                log.audit('Change required', kitName + ': from ' + startingKitStatus + ' to ' + kitStatus);

                var kit =  record.load({
                    type: record.Type.KIT_ITEM,
                    id: kitId,
                    isDynamic: false
                });

                kit.setValue ({
                    fieldId: 'custitem_bb1_item_status',
                    value: kitStatus
                });

                kit.save();

            } else {
                log.audit('No change required', kitName);
            }

            return;
        }

        function getBadness(n){

            // convert status to numeric where lower is better

            switch(n) {
                //Available	4
                case '4':
                    return 1;
                //Discontinued	2
                case '2':
                    return 15;
                //OOS - Set Date	5
                case '5':
                    return 8;
                //Obsolete	3
                case '3':
                    return 11;
                 //OOS - Uncertain Date	6
                case '6':
                    return 10;
                //Unable to Source	7
                case '7':
                    return 20;
                //To Be Discontinued	8
                case '8':
                    return 3;
                //Under Review	9
                case '9':
                    return 12;
                //Not Yet Set	10
                case '10':
                    return 25;
                default:
                return 99;
            }
        }

        return {
            onAction: onAction
        }
    });