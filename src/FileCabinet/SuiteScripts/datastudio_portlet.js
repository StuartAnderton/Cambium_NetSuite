/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */
define(['N/https', 'N/record', 'N/runtime'],
    function (https, record, runtime) {
        function render(params) {
            params.portlet.title = 'Stripe Sales';
            var content;
            content = '<iframe width="934" height="430" src="https://datastudio.google.com/embed/reporting/16ybSx4qGn1g13R95rkb_oNGzNJcmLcTo/page/bBmP" frameborder="0" style="border:0" allowfullscreen></iframe>';
            params.portlet.html = content;
        }

        return {
            render: render
        };
    });