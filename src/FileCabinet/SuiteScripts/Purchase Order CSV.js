/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/file', 'N/search', 'N/record', 'N/format'], /**
 * @param {file} file
 */ function (file, search, record, format) {
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function createCSVFile(context) {
        try {
            // Creating variables that will be populated from the saved search results
            var content = new Array();
            var csvColumns = new Array();
            var lineOne = '';

            log.debug('running', context);

            var orderId = context.request.parameters.orderid;
            var orderName = context.request.parameters.ordername;

            var po = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: orderId
            })

            var poDate = po.getValue({fieldId: 'custbody_date_approved'});
            poDate = format.format({value: poDate, type: format.Type.DATE});
            var supplier = po.getText({fieldId: 'entity'});
            var subtotal = po.getValue({fieldId: 'subtotal'});
            var tax = po.getValue({fieldId: 'taxtotal'});
            var total = po.getValue({fieldId: 'total'});


            lineOne += 'Supplier,' + supplier + '\n';
            lineOne += 'Cambium PO,' + orderName + '\n';
            lineOne += 'Date Issued,' + poDate + '\n';
            lineOne +=  '\n';
            lineOne += 'Subtotal,' + subtotal + '\n';
            lineOne += 'Tax,' + tax + '\n';
            lineOne += 'Total,' + total + '\n';
            lineOne +=  '\n';


            // Load a Custom Search, by using its Internal ID
            var mySearch = search.load({
                id: 'customsearch_po_csv'
            });

            var defaultFilters = mySearch.filters;

            defaultFilters.push(search.createFilter({
                name: 'internalid',
                operator: search.Operator.ANYOF,
                values: orderId
            }));

            mySearch.filters = defaultFilters;

            // Run/Execute the loaded Search
            var resultSet = mySearch.run();

            resultSet.each(function (result) {
                var temp = '';
                log.debug('Row', result);
                for (var i = 0; i < mySearch.columns.length; i++) {
                    var searchResult = result.getValue(mySearch.columns[i]);
                    if (!searchResult) {searchResult = ''};
                    temp += '"' + searchResult + '",';
                }
                content.push(temp);
                return true;
            });

            resultSet.columns.forEach(function (col) {
                csvColumns.push(col.label);
            });

            for (var i = 0; i < csvColumns.length; i++) {
                lineOne += csvColumns[i] + ',';
            }

            // Looping through the content array and assigning it to the contents string variable.
            lineOne = lineOne + '\n';
            for (var j = 0; j < content.length; j++) {
                lineOne += content[j].toString() + '\n';
            }

            log.debug({ title: 'Contents from Line One', details: JSON.stringify(lineOne) });

            // Creating a csv file and passing the contents string variable.
            var csvFile = file.create({
                name: orderName + '.csv',
                fileType: file.Type.CSV,
                contents: lineOne,
                folder: '1064696' // Folder ID where the file should be saved in the File Cabinet
            });

            csvFile.save();
        } catch (error) {
            log.debug({ title: 'Catch - Error:', details: error });
        }
    }

    return {
        onRequest: createCSVFile
    };
});