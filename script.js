document.addEventListener('DOMContentLoaded', function() {
    // --- Referencias y eventos ---
    const form = document.getElementById('liquidacionForm');
    const modal = document.getElementById('modal');
    const closeModal = document.querySelector('.close-button');
    const btnGenerarPDF = document.getElementById('btnGenerarPDF');
    const pdfContent = document.getElementById('pdf-content');
    
    document.getElementById('fechaElaboracion').valueAsDate = new Date();
    
    form.addEventListener('submit', e => { e.preventDefault(); calcularYMostrarLiquidacion(); });
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', e => { if (e.target == modal) modal.style.display = 'none'; });
    btnGenerarPDF.addEventListener('click', imprimirLiquidacion);

    function parseDate(dateString) { if (!dateString) return null; const parts = dateString.split('-'); return new Date(parts[0], parts[1] - 1, parts[2]); }

    function calcularYMostrarLiquidacion() {
        // --- Recopilación de datos del formulario ---
        const data = {
            nombreEmpresa: document.getElementById('nombreEmpresa').value.toUpperCase(),
            fechaElaboracion: parseDate(document.getElementById('fechaElaboracion').value),
            fechaIngreso: parseDate(document.getElementById('fechaIngreso').value),
            fechaSalida: parseDate(document.getElementById('fechaSalida').value),
            nombreEmpleado: document.getElementById('nombreEmpleado').value,
            cedula: document.getElementById('cedula').value,
            motivoRetiro: document.getElementById('motivoRetiro').options[document.getElementById('motivoRetiro').selectedIndex].text.toUpperCase(),
            motivoRetiroValue: document.getElementById('motivoRetiro').value,
            tipoContrato: document.getElementById('tipoContrato').value,
            tipoSalario: document.getElementById('tipoSalario').value,
            puesto: document.getElementById('puesto').value,
            salarioMensual: parseFloat(document.getElementById('salarioMensual').value) || 0,
            fechaInicioSueldoPendiente: parseDate(document.getElementById('fechaInicioSueldoPendiente').value),
            sueldoPendienteDias: parseFloat(document.getElementById('sueldoPendienteDias').value) || 0,
            vacacionesPendientes: parseFloat(document.getElementById('vacacionesPendientes').value) || 0,
            // CAMPO NUEVO: Se obtiene el valor de otros ingresos
            otrosIngresos: parseFloat(document.getElementById('otrosIngresos').value) || 0,
            deduccionInventario: parseFloat(document.getElementById('deduccionInventario').value) || 0,
            otrasDeducciones: parseFloat(document.getElementById('otrasDeducciones').value) || 0,
            aplicarINSS: document.getElementById('aplicarINSS').checked,
            aplicarIR: document.getElementById('aplicarIR').checked,
            elaboradoPor: document.getElementById('elaboradoPor').value.toUpperCase(),
            revisadoPor: document.getElementById('revisadoPor').value.toUpperCase(),
            autorizadoPor: document.getElementById('autorizadoPor').value.toUpperCase(),
        };
        if (data.fechaSalida < data.fechaIngreso) { alert('La fecha de salida no puede ser anterior a la fecha de ingreso.'); return; }

        // --- Cálculos de Ingresos y Prestaciones ---
        const salarioDiario = data.salarioMensual / 30;
        const sueldoPendienteMonto = salarioDiario * data.sueldoPendienteDias;
        let fechaFinSueldoPendiente = null;
        if (data.fechaInicioSueldoPendiente && data.sueldoPendienteDias > 0) {
            fechaFinSueldoPendiente = new Date(data.fechaInicioSueldoPendiente.getTime());
            fechaFinSueldoPendiente.setDate(fechaFinSueldoPendiente.getDate() + data.sueldoPendienteDias - 1);
        }
        const tiempoTotalServicio = sifecha(data.fechaIngreso, data.fechaSalida);
        let fechaInicioAguinaldo;
        const primeroDiciembreAnterior = new Date(data.fechaSalida.getFullYear(), 11, 1);
        if (data.fechaSalida.getMonth() < 11) { primeroDiciembreAnterior.setFullYear(data.fechaSalida.getFullYear() - 1); }
        fechaInicioAguinaldo = (data.fechaIngreso < primeroDiciembreAnterior) ? primeroDiciembreAnterior : data.fechaIngreso;
        const tiempoAguinaldo = sifecha(fechaInicioAguinaldo, data.fechaSalida);
        const mesesParaAguinaldo = tiempoAguinaldo.years * 12 + tiempoAguinaldo.months + (tiempoAguinaldo.days / 30);
        const aguinaldoProporcional = (data.salarioMensual / 12) * mesesParaAguinaldo;
        const totalMesesTrabajados = tiempoTotalServicio.years * 12 + tiempoTotalServicio.months + (tiempoTotalServicio.days / 30);
        const diasVacacionesGanadas = totalMesesTrabajados * 2.5;
        const diasVacacionesGozadas = Math.max(0, diasVacacionesGanadas - data.vacacionesPendientes);
        const vacacionesMonto = salarioDiario * data.vacacionesPendientes;
        let indemnizacionMonto = 0;
        if (data.motivoRetiroValue !== 'renuncia_sin_preaviso' && data.motivoRetiroValue !== 'despido_justificado') {
            let diasIndemnizacion = 0;
            if (tiempoTotalServicio.years < 3) { diasIndemnizacion = (tiempoTotalServicio.years * 30) + (tiempoTotalServicio.months * (30 / 12)) + (tiempoTotalServicio.days * (30 / 12 / 30)); } 
            else { diasIndemnizacion = (3 * 30) + ((tiempoTotalServicio.years - 3) * 20) + (tiempoTotalServicio.months * (20 / 12)) + (tiempoTotalServicio.days * (20 / 12 / 30)); }
            indemnizacionMonto = Math.min(150, diasIndemnizacion) * salarioDiario;
        }

        // CÁLCULO ACTUALIZADO: Se suman los "Otros Ingresos" al total bruto.
        const totalIngresosBrutos = sueldoPendienteMonto + aguinaldoProporcional + vacacionesMonto + indemnizacionMonto + data.otrosIngresos;
        
        // --- Cálculos de Deducciones ---
        // BASE DE CÁLCULO CORREGIDA: Incluye sueldos, vacaciones y otros ingresos. Excluye aguinaldo e indemnización.
        const baseCalculoDeducciones = sueldoPendienteMonto + vacacionesMonto + data.otrosIngresos;
        let deduccionINSS = data.aplicarINSS ? baseCalculoDeducciones * 0.07 : 0;
        let deduccionIR = 0; // La lógica del IR puede ser compleja, se mantiene simple por ahora.
        const totalDeducciones = deduccionINSS + deduccionIR + data.deduccionInventario + data.otrasDeducciones;
        
        // --- Cálculo Final ---
        const netoAPagar = totalIngresosBrutos - totalDeducciones;
        const cantidadEnLetras = numeroALetras(netoAPagar);
        const f = (n) => n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatDate = (d) => d ? d.toLocaleDateString('es-NI', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
        
        // VISUALIZACIÓN ACTUALIZADA: Se añade la fila de "Otros Ingresos"
        pdfContent.innerHTML = `
            <div class="pdf-header"><h2>${data.nombreEmpresa}</h2><p>LIQUIDACION FINAL EN C$</p></div>
            <table class="info-table"><tr><td class="label">FECHA DE ELABORACION DE LA LIQUIDACIÓN</td><td class="value">${formatDate(data.fechaElaboracion)}</td></tr><tr><td class="label">FECHA DE INGRESO</td><td class="value">${formatDate(data.fechaIngreso)}</td></tr><tr><td class="label">FECHA DE SALIDA</td><td class="value">${formatDate(data.fechaSalida)}</td></tr><tr><td class="label">NOMBRE DEL EMPLEADO</td><td class="value">${data.nombreEmpleado}</td></tr><tr><td class="label">CEDULA DE IDENTIDAD</td><td class="value">${data.cedula}</td></tr><tr><td class="label">MOTIVO DE RETIRO</td><td class="value">${data.motivoRetiro}</td></tr><tr><td class="label">TIPO DE CONTRATO</td><td class="value">${data.tipoContrato}</td></tr><tr><td class="label">TIPO DE SALARIO</td><td class="value">${data.tipoSalario}</td></tr><tr><td class="label">PUESTO (CARGO DESEMPEÑADO)</td><td class="value">${data.puesto}</td></tr><tr><td class="label">SALARIO ORDINARIO MENSUAL</td><td class="value">${f(data.salarioMensual)}<span class="sub-value">SUELDO DIARIO ${salarioDiario.toFixed(5)}</span><span class="sub-value">SUELDO POR HORA ${(salarioDiario / 8).toFixed(4)}</span></td></tr></table>
            <b>INGRESOS</b><hr>
            <table class="prestaciones-table">
                <tr><td>SUELDO PENDIENTE DE PAGO</td><td>DEL</td><td>${formatDate(data.fechaInicioSueldoPendiente)}</td><td>AL DÍA</td><td>${formatDate(fechaFinSueldoPendiente)}</td><td>${data.sueldoPendienteDias}</td><td class="monto">${f(sueldoPendienteMonto)}</td></tr>
                <!-- Fila nueva para Otros Ingresos -->
                ${data.otrosIngresos > 0 ? `<tr><td class="concepto">OTROS INGRESOS (COMISIONES, BONOS, ETC.)</td><td colspan="5"></td><td class="monto">${f(data.otrosIngresos)}</td></tr>` : ''}
            </table>
            <b>PRESTACIONES SOCIALES</b>
            <table class="prestaciones-table"><thead><tr><th class="concepto">CONCEPTO</th><th>DEL</th><th>AL</th><th>DIAS</th><th>MESES</th><th>AÑOS</th><th>DIAS A FAVOR<div class="sub-header">(2.5 POR MES)</div></th><th>Deduccion de<br>vacaciones<br>descansadas</th><th>DIAS DE<br>VACACIONES<br>A PAGAR</th><th class="monto">MONTO EN C$</th></tr></thead><tbody><tr><td class="concepto">AGUINALDO<br>(Art. 93 CT)</td><td>${formatDate(fechaInicioAguinaldo)}</td><td>${formatDate(data.fechaSalida)}</td><td>${tiempoAguinaldo.days}</td><td>${tiempoAguinaldo.months}</td><td>${tiempoAguinaldo.years}</td><td colspan="3"></td><td class="monto">${f(aguinaldoProporcional)}</td></tr><tr><td class="concepto">VACACIONES<br>(Art. 78 CT)</td><td>${formatDate(data.fechaIngreso)}</td><td>${formatDate(data.fechaSalida)}</td><td>${tiempoTotalServicio.days}</td><td>${tiempoTotalServicio.months}</td><td>${tiempoTotalServicio.years}</td><td>${diasVacacionesGanadas.toFixed(2)}</td><td>${diasVacacionesGozadas.toFixed(2)}</td><td>${data.vacacionesPendientes.toFixed(2)}</td><td class="monto">${f(vacacionesMonto)}</td></tr><tr><td class="concepto">INDEM.ANT.<br>(Art. 45 CT)</td><td colspan="5">Tiempo de Servicio</td><td colspan="3"></td><td class="monto">${f(indemnizacionMonto)}</td></tr></tbody></table>
            <table class="totales-table"><tr><td class="label">TOTAL DE INGRESOS</td><td class="value">C$ ${f(totalIngresosBrutos)}</td></tr><tr><td class="label">MENOS DEDUCCIONES:</td><td class="value">C$ ${f(totalDeducciones)}</td></tr><tr><td class="label"><span class="highlight">FALTANTE DE INVENTARIO</span></td><td class="value"><span class="highlight">${f(data.deduccionInventario)}</span></td></tr><tr><td class="label">OTRAS DEDUCCIONES (INCL. LEY)</td><td class="value">${f(data.otrasDeducciones + deduccionINSS + deduccionIR)}</td></tr><tr><td class="label">NETO A RECIBIR:</td><td class="value">C$ ${f(netoAPagar)}</td></tr></table>
            <table class="letras-table"><tr><td class="label">CANTIDAD EN LETRAS:</td><td class="value">${cantidadEnLetras}</td></tr></table>
            <p class="texto-finiquito">Por este medio de la presente hago constar que recibo de <strong>${data.nombreEmpresa}</strong>, mi liquidación a mi entera satisfacción final, a la que tengo derecho según nuestras leyes. Eximiendo al señor EMPLEADOR de cualquier reclamo posterior. Finiquitando de esta manera el vínculo laboral. sin mas a que hacer referencias firma la presente liquidacion.</p>
            <table class="firmas-table"><tr><td><div class="firma-block"><div class="label">ELABORADO POR:</div><div class="name">${data.elaboradoPor}</div></div></td><td><div class="firma-block"><div class="label">REVISADO POR:</div><div class="name">${data.revisadoPor}</div></div></td></tr><tr><td><div class="firma-block"><div class="label">RECIBI CONFORME:</div><div class="name">${data.nombreEmpleado}<br>${data.cedula}</div></div></td><td><div class="firma-block"><div class="label">AUTORIZADO POR:</div><div class="name">${data.autorizadoPor}</div></div></td></tr></table>
            `;
        modal.style.display = 'block';
    }
    
    function imprimirLiquidacion() {
        const contenidoParaImprimir = document.getElementById('pdf-content').innerHTML;
        const estilos = document.querySelector('link[href="style.css"]').outerHTML;
        const ventanaImpresion = window.open('', '_blank');
        ventanaImpresion.document.write(`
            <html>
                <head>
                    <title>Comprobante de Liquidación</title>
                    ${estilos}
                    <style>
                        body { margin: 25px; background-color: #fff; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    ${contenidoParaImprimir}
                </body>
            </html>
        `);
        ventanaImpresion.document.close();
        ventanaImpresion.onload = function() {
            ventanaImpresion.focus();
            ventanaImpresion.print();
            ventanaImpresion.close();
        };
    }

    function sifecha(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return { years: 0, months: 0, days: 0 };
        let inicio = new Date(fechaInicio.getTime()); let fin = new Date(fechaFin.getTime());
        let anios = fin.getFullYear() - inicio.getFullYear(); let meses = fin.getMonth() - inicio.getMonth(); let dias = fin.getDate() - inicio.getDate();
        if (dias < 0) { meses--; dias += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate(); }
        if (meses < 0) { anios--; meses += 12; }
        return { years: anios, months: meses, days: dias };
    }
    
    function numeroALetras(num) {
        var Unidades=function(num){switch(num){case 1:return"UN";case 2:return"DOS";case 3:return"TRES";case 4:return"CUATRO";case 5:return"CINCO";case 6:return"SEIS";case 7:return"SIETE";case 8:return"OCHO";case 9:return"NUEVE"}return""};var Decenas=function(num){let a=Math.floor(num/10),r=num-10*a;switch(a){case 1:switch(r){case 0:return"DIEZ";case 1:return"ONCE";case 2:return"DOCE";case 3:return"TRECE";case 4:return"CATORCE";case 5:return"QUINCE";default:return"DIECI"+Unidades(r)}case 2:switch(r){case 0:return"VEINTE";default:return"VEINTI"+Unidades(r)}case 3:return DecenasY("TREINTA",r);case 4:return DecenasY("CUARENTA",r);case 5:return DecenasY("CINCUENTA",r);case 6:return DecenasY("SESENTA",r);case 7:return DecenasY("SETENTA",r);case 8:return DecenasY("OCHENTA",r);case 9:return DecenasY("NOVENTA",r);case 0:return Unidades(r)}};function DecenasY(e,r){return r>0?e+" Y "+Unidades(r):e}function Centenas(e){let r=Math.floor(e/100),t=e-100*r;switch(r){case 1:return t>0?"CIENTO "+Decenas(t):"CIEN";case 2:return"DOSCIENTOS "+Decenas(t);case 3:return"TRESCIENTOS "+Decenas(t);case 4:return"CUATROCIENTOS "+Decenas(t);case 5:return"QUINIENTOS "+Decenas(t);case 6:return"SEISCIENTOS "+Decenas(t);case 7:return"SETECIENTOS "+Decenas(t);case 8:return"OCHOCIENTOS "+Decenas(t);case 9:return"NOVECIENTOS "+Decenas(t)}return Decenas(t)}function Seccion(e,r,t,n){let a=Math.floor(e/r),o=e-a*r,s="";return a>0&&(s=a>1?Centenas(a)+" "+n:t),o>0&&(s+=""),s}function Miles(e){let r=1e3,t=Math.floor(e/r),n=e-t*r,a=Seccion(e,r,"UN MIL","MIL"),o=Centenas(n);return""==a?o:a+" "+o}function Millones(e){let r=1e6,t=Math.floor(e/r),n=e-t*r,a=Seccion(e,r,"UN MILLON DE","MILLONES DE"),o=Miles(n);return""==a?o:a+" "+o}let currency={plural:"CÓRDOBAS",singular:"CÓRDOBA"},data={numero:num,enteros:Math.floor(num),centavos:Math.round(100*num)-100*Math.floor(num),letrasCentavos:"",letrasMonedaPlural:currency.plural,letrasMonedaSingular:currency.singular};return data.centavos>0&&(data.letrasCentavos="CON "+data.centavos.toString().padStart(2,"0")+"/100"),0==data.enteros?"CERO "+data.letrasMonedaPlural+" "+data.letrasCentavos:1==data.enteros?Millones(data.enteros)+" "+data.letrasMonedaSingular+" "+data.letrasCentavos:Millones(data.enteros)+" "+data.letrasMonedaPlural+" "+data.letrasCentavos
    }
});
