/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/runtime', 'N/search'],
    /**

     */
    (record, runtime, search) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            const scriptObj = runtime.getCurrentScript();
            const sosToChangeSearchId = scriptObj.getParameter({name: 'custscript_shipmethods_search_id'});

            const sosToChangeSearch = search.load({
                id: sosToChangeSearchId
            })

            sosToChangeSearch.run().each(function (result) {

                log.debug('Line', result)

                var correctShipMethodText = result.getValue({
                    name: 'formulatext'
                })

                log.debug('New ShipMethod', correctShipMethodText)

                var thisSOId = result.getValue({
                    name: 'internalid'
                })

                var thisSO = record.load({
                    type: record.Type.SALES_ORDER,
                    id: thisSOId
                })

                thisSO.setText({
                    fieldId: 'shipmethod',
                    text: correctShipMethodText
                })

                var savedSO = thisSO.save()

                log.audit('Updated SO', savedSO)

                return true

            });


        }

        return {execute}

    });
