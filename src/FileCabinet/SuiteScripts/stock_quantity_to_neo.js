/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */



define(['N/search', 'N/record'],
    function (search, record) {

        var inventory = {}
        var location = {}
        function onRequest(context) {


            request = context.request;
            var request = context.request;
            var params = request.parameters;
            var id = params.exId;

            search.create({
                type: search.Type.INVENTORY_ITEM,
                filters: ['externalId', 'is', id]
            }).run().each(processResult)


          try {
            
            var numLines = inventory.getLineCount({
                sublistId: 'locations'
            });

            if (numLines > 0) {
                for (var i = 0; i < numLines; i++) {

                    location.locationName = inventory.getSublistValue({
                        sublistId: 'locations',
                        fieldId: 'location_display',
                        line: i
                    });
                    location.locationId = inventory.getSublistValue({
                        sublistId: 'locations',
                        fieldId: 'locationid',
                        line: i
                    });
                    location.quantity = inventory.getSublistValue({
                        sublistId: 'locations',
                        fieldId: 'quantityavailable',
                        line: i
                    });

                    if (location.locationName === 'Swindon 1')
                        break;

                }
            }
          } catch (exc) {
            log.error('Failed on Group ID', id);
          }

            context.response.write(JSON.stringify(location))

        }

        function processResult(result) {

            log.audit(result.id, result);

            var item = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: result.id
            });
            inventory = item;

        }

        return {
            onRequest: onRequest
        }
    });
