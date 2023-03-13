/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */

/*
Portlet to query the HappyFox API and return the most recent tickets raised by/about this customer
Used in the Customer dashboard.
*/
define(['N/https', 'N/record', 'N/ui/serverWidget', 'N/encode', 'N/format'],
    function(https, record, serverWidget, encode, format) {
        function render(params) {
            params.portlet.title = 'HappyFox Recent Tickets';


            var subjectCol = params.portlet.addColumn({
                id: 'subject',
                label: 'Ticket subject',
                type: serverWidget.FieldType.TEXT,
                align: serverWidget.LayoutJustification.LEFT
            });

            var dateCol = params.portlet.addColumn({
                id: 'date',
                label: 'Last updated',
                type: serverWidget.FieldType.TEXT,
                align: serverWidget.LayoutJustification.LEFT
            });

            var statusCol = params.portlet.addColumn({
                id: 'status',
                label: 'Status',
                type: serverWidget.FieldType.TEXT,
                align: serverWidget.LayoutJustification.LEFT
            });

            var agentCol = params.portlet.addColumn({
                id: 'agent',
                label: 'Assigned to',
                type: serverWidget.FieldType.TEXT,
                align: serverWidget.LayoutJustification.LEFT
            });

            var linkCol = params.portlet.addColumn({
                id: 'link',
                label: 'Link to ticket',
                type: serverWidget.FieldType.TEXT,
                align: serverWidget.LayoutJustification.LEFT
            });

            /**
             * Get wishlist ID
             */

            customer = record.load({
                type: record.Type.CUSTOMER,
                id: params.entity
            });
            var cms_id = customer.getValue({
                fieldId: 'externalid'
            });

            cms_id = cms_id.substr(1,8);

            /**
             * Authenticate
             */

            var auth_string = '321a8c1da36f42c2997ce94fd42185cd:6d9a3f8e47d2423790aaa4bf667a5e94';

            var hexEncodedString = encode.convert({
                string: auth_string,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64
            });

            var headers = { 'Authorization': 'Basic ' + hexEncodedString};




            var url = 'https://prezola.happyfox.com/api/1.1/json/tickets/?q=%22Wishlist%20ID%22%3A%22' + cms_id +'%22';

            var response = https.get({
                url: url,
                headers: headers
            });
            body_json = JSON.parse(response.body);

            var page_info = body_json['page_info'];
            var number_of_tickets = page_info['count'];
            if (number_of_tickets) {
                params.portlet.title = 'HappyFox: Most Recent of ' + number_of_tickets + ' Tickets';
            } else {
                params.portlet.title = 'No HappyFox tickets found';
            }


            var pi = JSON.stringify(page_info);
            var data = body_json['data'];
            var content = '';
            for (ticket_number in data) {

                var ticket = data[ticket_number];
                var subject = ticket['subject'];
                var last_updated_at = ticket['last_updated_at'];
                var id = ticket['id'];
                var link = '<A HREF="https://prezola.happyfox.com/staff/ticket/' + id + '"> https://prezola.happyfox.com/staff/ticket/' + id + '<\A>';
                var assigned_to = ticket['assigned_to'];
                if (assigned_to) {
                    var agent = assigned_to['name'];
                }
                var status = ticket['status'];
                if (status) {

                var status_name = status['name'];
            }

                params.portlet.addRow({
                    row: {
                        subject: subject,
                        date: last_updated_at,
                        status: status_name,
                        agent: agent,
                        link: link
                    }
                });
                /**
                 *
                 * @type {string}

                content = content +
                    '<div><td><span> ' + subject + '</span></td></div></br>\n' +
                    '<div><td><span> ' + last_updated_at + '</span></td></div></br>\n' +
                    '<div><td><span> ' + id + '</span></td></div></br>\n' +
                    '<div><td><span> ' + agent + '</span></td></div></br>\n';
                 */

            }
         }
        return {
            render: render
        };
    });
