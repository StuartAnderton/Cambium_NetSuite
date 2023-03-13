/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Looks up a product based on EAN


define(['N/record', 'N/ui/serverWidget', 'N/ui/message', 'N/runtime', 'N/https', 'N/redirect', 'N/search'],
    function (record, serverWidget, message, runtime, https, redirect, search) {
        function onRequest(context) {


            log.audit({title: 'Lookup Product by EAN being run'});

            if (context.request.method === 'GET') {

                //Display  form

                var form = serverWidget.createForm({
                    title: 'Lookup Item',
                    hideNavBar: false
                });

                var htmlHeader = form.addField({
                    id: 'custpage_header',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                }).updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTROW
                }).defaultValue = '<p style=\'font-size:20px\'>Enter an EAN/UPC/Barcode to look up</p><br><br>';


                var ean = form.addField({
                    id: 'custpage_ean',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Enter EAN/UPC'
                });


                form.addSubmitButton({
                    label: 'Lookup'
                });

                context.response.writePage(form);

            } else {

                // Process return from confirmation form

                var request = context.request;


                params = request.parameters;

                ean = params.custpage_ean;
log.debug(params);
                var html;
                html = 'Looking up ' + ean + '<p>';

                var itemSearchColName = search.createColumn({name: 'itemid', sort: search.Sort.ASC});
                var itemSearchColSiteTitle = search.createColumn({name: 'custitem_bb1_site_title'});
                var itemSearchColDescriptionDefaulttws = search.createColumn({name: 'custitem_description_default'});
                var itemSearch = search.create({
                    type: 'item',
                    filters: [
                        ['upccode', 'is', ean]
                    ],
                    columns: [
                        itemSearchColName,
                        itemSearchColSiteTitle,
                        itemSearchColDescriptionDefaulttws
                    ]
                });


                 itemSearch.run().each(function(searchResult) {


                    /*if (!searchResults) {
                        html = 'EAN not found'
                        context.response.write(html);
                        return
                    }
    */


                    var name = searchResult.getValue({name: 'itemid'});
                    var title = searchResult.getValue({name: 'custitem_bb1_site_title'});
                    var description = searchResult.getValue({name: 'custitem_description_default'});
html = html +'</p>'
                    html = html + 'Product found </p>';
                    html = html + name + '</p>';
                    html = html + title + '</p>';
                    html = html + description + '</p>';
                })

                html = html + '<button type="button">Send to Buying</button>'

                context.response.write(html);



            }
        }


        return {
            onRequest: onRequest
        }
    });
