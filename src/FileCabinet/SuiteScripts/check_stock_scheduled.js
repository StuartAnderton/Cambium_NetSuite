/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */


/**
 * Check for stock changes and set values in Item accordingly
 */

define(['N/record', 'N/search'],


    function (record, search) {


        function execute(scriptContext) {

            var inventoryitemSearchColId = search.createColumn({name: 'internalid', sort: search.Sort.ASC});
            var inventoryitemSearchColDisplayName = search.createColumn({name: 'displayname'});
            var inventoryitemSearchColAvailable = search.createColumn({name: 'locationquantityavailable'});
            var inventoryitemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['inventorylocation.name', 'is', 'Swindon 1'],
                    'AND',
                    ['formulanumeric: NVL({locationquantityavailable},0) - nvl({custitem_stock_quantity}, 0)', 'notequalto', '0'],
                ],
                columns: [
                    inventoryitemSearchColId,
                    inventoryitemSearchColDisplayName,
                    inventoryitemSearchColAvailable
                ]
            });

            var inventoryitemSearchPagedData = inventoryitemSearch.runPaged({pageSize: 1000});
            for (var i = 0; i < inventoryitemSearchPagedData.pageRanges.length; i++) {
                var inventoryitemSearchPage = inventoryitemSearchPagedData.fetch({index: i});
                inventoryitemSearchPage.data.forEach(function (result) {

                    var itemId = result.getValue(inventoryitemSearchColId);
                    var displayName = result.getValue(inventoryitemSearchColDisplayName);
                    var available = result.getValue(inventoryitemSearchColAvailable);

                    log.debug('Processing', result);

                    // calculate the Outlet on hand

                    const transactionSearchColItem = search.createColumn({name: 'item', summary: search.Summary.GROUP});
                    const transactionSearchColFormulaNumericXZL275IJ = search.createColumn({
                        name: 'formulanumeric',
                        summary: search.Summary.SUM,
                        formula: 'NVL({quantitycommitted}, 0)'
                    });
                    const transactionSearch = search.create({
                        type: 'transaction',
                        filters: [
                            ['custbody_owning_brand', 'anyof', '13'],
                            'AND',
                            ['item', 'is', itemId],
                            'AND',
                                ['type', 'anyof', 'SalesOrd'],
                        ],
                        columns: [
                            transactionSearchColItem,
                            transactionSearchColFormulaNumericXZL275IJ,
                        ],
                    });

                    var searchResult = transactionSearch.run().getRange({start: 0, end: 1})[0]




                    var itemRecord = record.load({
                        type: record.Type.INVENTORY_ITEM,
                        id: itemId,
                        isDynamic: false
                    });

                    itemRecord.setValue({
                        fieldId: 'custitem_stock_quantity',
                        value: available,
                        ignoreFieldChange: true
                    });

                    if (searchResult) {


                        const outletCommitted = searchResult.getValue(transactionSearchColFormulaNumericXZL275IJ);

                        log.debug('Outlet Committed', outletCommitted)

                        const outletOnHand = Number(available) + Number(outletCommitted)


                        itemRecord.setValue({
                            fieldId: 'custitem_outlet_on_hand',
                            value: outletOnHand,
                            ignoreFieldChange: true
                        });

                    }

                    try {
                        var id = itemRecord.save();
                        log.audit('Updated ' + displayName, available);
                    } catch (err) {
                        log.error('Save failed', itemId);
                        log.error('Error', err);
                    }

                });
            }

        }

        return {
            execute: execute
        };


    }
);




