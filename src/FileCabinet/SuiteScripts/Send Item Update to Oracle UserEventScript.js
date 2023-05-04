/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * Script to send selected data from a record to API on event
 */

define(['N/https', 'N/record', 'N/runtime', 'N/search'],
    /**
     */
    (https, record, runtime, search) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            log.debug('Running', scriptContext)

            let headers;
            let url;
            let payload;
            let response;

            //const itemTypes = [record.Type.ASSEMBLY_ITEM, record.Type.KIT_ITEM, record.Type.INVENTORY_ITEM]

            // Choose URL based on environment
            const script = runtime.getCurrentScript();
            const isProduction = runtime.envType === runtime.EnvType.PRODUCTION;
            if (isProduction) {
                url = script.getParameter({name: 'custscript_production_url_item'});
            } else {
                url = script.getParameter({name: 'custscript_qa_url_item'})
            }

            // Searches which define the fields to send
            const recordSearchId = script.getParameter({name: 'custscript_item_search_2'});
            const recordSummarySearchId = script.getParameter({name: 'custscript_item_search_summary'});
            const recordSummaryIsLines = script.getParameter({name: 'custscript_item_search_summary_lines'});
            // Flag field used by separate WF to retry any fails
            var flag = script.getParameter({name: 'custscript_sync_flag_item'})

            var newRecord = scriptContext.newRecord;
            const oldRecord = scriptContext.oldRecord;
            const context = scriptContext.type;

            /* // Don't send Item if LNU not changed (Not sure if still needed given script execution context limits)
            if (itemTypes.includes(newRecord.type)
                && newRecord.getValue('custitem_last_notifiable_update') === oldRecord.getValue('custitem_last_notifiable_update')
                && context !== scriptContext.UserEventType.CREATE) {
                return
            } */

            log.debug('item', newRecord)

            const recordId = newRecord.getValue('id');

            // Run the search to get results to send

            const recordSearch = search.load({
                id: recordSearchId
            });

            let searchResults = '';
            let defaultFilters = recordSearch.filters;

            defaultFilters.push(search.createFilter({
                name: 'internalid',
                operator: search.Operator.ANYOF,
                values: recordId
            }));

            recordSearch.filters = defaultFilters;

            log.debug('Filters', defaultFilters)

            searchResults = recordSearch.run();

            var recordData = searchResults.getRange({start: 0, end: 1})[0];

            log.debug('Results', recordData)

            if (!recordData) {
                log.audit('No Search Results', recordId)
                return
            }

            // run summary search

            if (recordSummarySearchId) {

                const recordSummarySearch = search.load({
                    id: recordSummarySearchId
                });

                let summarySearchResults = '';
                let summaryDefaultFilters = recordSummarySearch.filters;

                summaryDefaultFilters.push(search.createFilter({
                    name: 'internalid',
                    operator: search.Operator.ANYOF,
                    values: recordId
                }));

                recordSummarySearch.filters = summaryDefaultFilters;

                log.debug('Filters', summaryDefaultFilters)

                summarySearchResults = recordSummarySearch.run();

                var recordSummaryDataArray = summarySearchResults.getRange({start: 0, end: 1000});


                log.debug('Summary Results', recordSummaryDataArray)

                if (!recordSummaryDataArray) {
                    log.error('No Summary Search Results', recordId)
                    return
                }

                // merge the two results

                let recordValues = recordData.toJSON().values;

                var summaryRecordValues
                var summaryRecordValuesArray = []
                var mergedRecordValues

                if (!recordSummaryIsLines) {

                    summaryRecordValues = recordSummaryDataArray[0].toJSON().values

                    mergedRecordValues = {
                        ...recordValues,
                        ...summaryRecordValues
                    };

                } else {
                    for (var i = 0; i < recordSummaryDataArray.length; i++) {

                        summaryRecordValuesArray.push(recordSummaryDataArray[i].toJSON().values)

                    }
                    log.debug('summaryRecordValuesArray', summaryRecordValuesArray)

                    mergedRecordValues = recordValues

                    mergedRecordValues['lines'] = summaryRecordValuesArray;

                }


            } else {
                mergedRecordValues = recordData.toJSON().values;
            }

            // add context

            mergedRecordValues['context'] = context;

            log.debug('values', mergedRecordValues)

            const recordType = recordData.recordType;

            log.debug('type', recordType)

            var flagset = newRecord.getValue(flag)

            log.debug('flag state', flagset)


            try {

                headers = {
                    'Content-Type': 'application/json',
                    accept: 'application/json'
                };

                payload = mergedRecordValues;

                log.debug('Payload', payload)

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload),
                });

                log.debug('Response', response)

                if (response.code == '200' || response.code == '204') {
                    log.audit('Record Update Sent', recordId);
                    if (flagset == true) {
                        log.debug('Resetting flag as flagset == true', flagset)
                        setSyncFlag(recordId, recordType, flag, false)
                    }

                } else {
                    log.error({title: 'Request failed', details: response.body});
                    setSyncFlag(recordId, recordType, flag, true);
                }
            } catch (err) {
                log.error('Request failed', err);
                setSyncFlag(recordId, recordType, flag, true);
            }


        }

        function setSyncFlag(recordId, recordType, flag, value) {

            /*
            let typeVar = ''

              switch (recordType) {
                 case 'inventoryitem':
                     typeVar = record.Type.INVENTORY_ITEM;
                     break;
                 case 'kititem':
                     typeVar = record.Type.KIT_ITEM;
                     break;
                 case 'assemblyitem':
                     typeVar = record.Type.ASSEMBLY_ITEM;
                     break;
                 default:
                     log.error('Invalid Record Type', recordType)
             } */

            log.debug('Change Sync Flag', [recordId, recordType, flag, value])
            const recordToUpdate = record.load({
                type: recordType,
                id: recordId
            });

            log.debug('Updating Flag on', recordToUpdate)

            recordToUpdate.setValue({
                fieldId: flag,
                value: value
            });

            recordToUpdate.save();

            log.audit('Flag changed', [recordId, value])

        }

        return {afterSubmit}

    });
