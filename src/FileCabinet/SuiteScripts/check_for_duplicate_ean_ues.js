/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
// Before Submit: On Create, checks uniqueness of EAN and MPN and rejects creation of duplicates
// After Submit: Checks if the Draft EAN already exists as a real EAN/UPC in NetSuite, and if it does flags as a duplicate. If not a duplicate,
// copies from draft to the actual EAN/UPC

// Load  standard modules.
define(['N/record', 'N/search', 'N/error'],

    // Add the callback function.
    function (record, search, error) {

        function myBeforeSubmit(context) {

            if (context.type === context.UserEventType.CREATE) {

                log.debug('Processing Starting')

                //check EAN

                checkEan(context)

                // Check MPN

                checkMpn(context)

            }

        }

        function checkEan(context) {

            var newItem = context.newRecord;

            var draftEan = newItem.getValue({
                fieldId: 'custitem_draft_ean'
            });
            log.debug('draftEan', draftEan);

            // do nothing if no Draft EAN

            if (draftEan === null | draftEan == '') {
                log.debug('No Draft EAN to check')
                return;
            }

            // Search for Items with the Draft EAN as their EAN

            var itemSearchColInternalId = search.createColumn({name: 'internalid'});
            var itemSearchColExternalId = search.createColumn({name: 'externalid'});

            var itemSearch = search.create({
                type: 'item',
                filters: [
                    ['type', 'anyof', 'InvtPart', 'Kit'],
                    'AND',
                    [
                        ['upccode', 'is', draftEan],
                        'OR',
                        ['custitem_previous_ean', 'is', draftEan],
                    ],
                ],
                columns: [
                    itemSearchColInternalId,
                    itemSearchColExternalId
                ]
            });

            var searchResult = itemSearch.run().getRange({start: 0, end: 1});
            log.debug('Search Result', searchResult)


            if (searchResult.length === 0) {

                log.debug('No duplicate found', draftEan)

                newItem.setValue({
                    fieldId: 'upcode',
                    value: draftEan
                })

                newItem.setValue({
                    fieldId: 'custitem_ean_',
                    value: draftEan
                });

            } else {

                log.audit('Duplicate EAN found', draftEan)

                var existingItem = searchResult[0].getText(itemSearch.columns[1])

                log.debug('existing item', existingItem)

                throw error.create({
                    name: 'DUPLICATE_EAN_UPC',
                    message: 'The EAN/UPC ' + draftEan + ' already exists on product ' + existingItem
                })
            }
        }

        function checkMpn(context) {

            var newItem = context.newRecord;

            var mpn = newItem.getValue({
                fieldId: 'mpn'
            });
            log.debug('mpn', mpn);

            // do nothing if no MPN

            if (mpn === null | mpn == '') {
                log.debug('No MPN to check')
                return;
            }

            var brand = newItem.getValue({
                fieldId: 'custitem_brand'
            });

            var pattern = /[^a-zA-Z0-9]/g

            var mpn_normalised = mpn.replace(pattern, '')

            log.debug('Normalised 1', [mpn, mpn_normalised])

            mpn_normalised = mpn_normalised.toUpperCase();

            log.debug('Normalised 2', [mpn, mpn_normalised])

            // Search for Items with the MON

            const inventoryitemSearchColInternalId = search.createColumn({name: 'internalid'});
            const inventoryitemSearchColExternalId = search.createColumn({name: 'externalid'});
            var formula = 'FORMULATEXT: UPPER(REGEXP_REPLACE({mpn}, \'[^a-zA-Z0-9]\', \'\'))'


            const itemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['custitem_brand', 'is', brand],
                    'AND',
                    ['isinactive', 'is', 'F'],
                    'AND',
                    [formula, 'is', mpn_normalised],
                    'AND',
                    ['custitem_brand', 'noneof', '9125']

                ],
                columns: [
                    inventoryitemSearchColInternalId,
                    inventoryitemSearchColExternalId
                ],
            });

            var searchResult = itemSearch.run().getRange({start: 0, end: 1});
            log.debug('Search Result', searchResult)

            if (searchResult.length === 0) {

                log.debug('No duplicate found', mpn_normalised)

            } else {

                log.audit('Dupliate mpn found', mpn)

                var existingItem = searchResult[0].getText(itemSearch.columns[1])

                log.debug('existing item', existingItem)

                throw error.create({
                    name: 'DUPLICATE_MPN',
                    message: 'The MPN ' + mpn + ' already exists on product ' + existingItem
                })
            }
        }


        function myAfterSubmit(context) {

            var newItem = context.newRecord;
            log.debug('Processing', newItem)

            var itemId = newItem.getValue({
                fieldId: 'id'
            });
            log.debug('ItemId', itemId);

            var draftEan = newItem.getValue({
                fieldId: 'custitem_draft_ean'
            });
            log.debug('draftEan', draftEan);

            var ean = newItem.getValue({
                fieldId: 'upccode'
            });
            log.debug('ean', ean);

            var recordType = newItem.type;

            // do nothing if no Draft EAN or it's already been copied.

            if (draftEan === null | draftEan == '') {
                log.debug('No Draft EAN', itemId)
                return;
            }

            if (draftEan === ean) {
                log.debug('DraftEAN and EAN are the same', itemId)
                return;
            }

            // Search for Items with the Draft EAN as their EAN

            var itemSearchColInternalId = search.createColumn({name: 'internalid'});

            var itemSearch = search.create({
                type: 'item',
                filters: [
                    ['type', 'anyof', 'InvtPart', 'Kit'],
                    'AND',
                    ['internalid', 'noneof', itemId],
                    'AND',
                    [
                        ['upccode', 'is', draftEan],
                        'OR',
                        ['custitem_previous_ean', 'is', draftEan],
                    ],
                ],
                columns: [
                    itemSearchColInternalId
                ]
            });

            var searchResult = itemSearch.run().getRange({start: 0, end: 1});
            log.debug('Search Result', searchResult)

            var recordToChange = record.load({
                type: recordType,
                id: itemId
            });

            var oldEan = recordToChange.getValue({
                fieldId: 'upccode'
            });

            if (searchResult.length == 0) {

                recordToChange.setValue({
                    fieldId: 'upccode',
                    value: draftEan,
                    ignoreFieldChange: true
                });

                recordToChange.setValue({
                    fieldId: 'custitem_previous_ean',
                    value: oldEan,
                    ignoreFieldChange: true
                });

                recordToChange.setValue({
                    fieldId: 'custitem_draft_ean_unique',
                    value: false,
                    ignoreFieldChange: true
                });

                recordToChange.setValue({
                    fieldId: 'custitem_ean_',
                    value: draftEan,
                    ignoreFieldChange: true
                });

                log.debug('No Dupliate EAN, copying', itemId)

            } else {

                recordToChange.setValue({
                    fieldId: 'custitem_draft_ean_unique',
                    value: true,
                    ignoreFieldChange: true
                });

                log.audit('Dupliate EAN, flagging', itemId)

            }

            var result = recordToChange.save();

            log.debug('Changed', result)

        }

// Add the return statement that identifies the entry point functions.
        return {
            beforeSubmit: myBeforeSubmit,
            afterSubmit: myAfterSubmit
        };
    })
;