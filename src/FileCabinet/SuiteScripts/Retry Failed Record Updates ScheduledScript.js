/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * Scheduled script yto retry failed  API event sends
 *
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

            touchRecords('customrecord_brand', 'custrecord_brand_requires_sync', 'custrecord_dummy_for_touch');
            touchRecords(search.Type.CUSTOMER, 'custentity_requires_sync', 'custentity_dummy_for_touch');
            touchRecords(search.Type.ITEM, 'custitem_requires_sync', 'custitem_dummy_for_touch');
            touchRecords('customrecord_contact_notes_entry', 'custrecord_cn_sync_required', 'custrecord_cn_dummy');

            // touchRecords(search.Type.VENDOR, 'custentity_requires_sync');






        }

        return {execute}


        function touchRecords(type, flag, dummy) {

            log.debug('Running', [type, flag])

            const itemSearchColInternalId = search.createColumn({name: 'internalid'});
            const itemSearch = search.create({
                type: type,
                filters: [
                    [flag, 'is', 'T'],
                ],
                columns: [
                    itemSearchColInternalId,
                ],
            });

            const itemSearchPagedData = itemSearch.runPaged({pageSize: 1000});
            for (let i = 0; i < itemSearchPagedData.pageRanges.length; i++) {
                const itemSearchPage = itemSearchPagedData.fetch({index: i});
                itemSearchPage.data.forEach((result) => {
                    const internalId = result.getValue(itemSearchColInternalId);


                    const recordToEdit = record.load({
                        type: result.recordType,
                        id: internalId
                    })

                    const now = new Date()
                    const dummyValue = now.getMilliseconds()

                    recordToEdit.setValue({
                        fieldId: dummy,
                        value: dummyValue
                    })

                    recordToEdit.save()

                });
            }
        }

    });
