document.addEventListener('DOMContentLoaded', function() {
    // --- Referencias y eventos ---
    const form = document.getElementById('liquidacionForm');
    const modal = document.getElementById('modal');
    const closeModal = document.querySelector('.close-button');
    const btnGenerarPDF = document.getElementById('btnGenerarPDF');
    const pdfContent = document.getElementById('pdf-content');
    
    // Establecer fecha actual como fecha de elaboración por defecto
    document.getElementById('fechaElaboracion').valueAsDate = new Date();
    
    // Event Listeners
    form.addEventListener('submit', e => { e.preventDefault(); calcularYMostrarLiquidacion(); });
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', e => { if (e.target == modal) modal.style.display = 'none'; });
    
    // Variable para controlar si el PDF está generándose
    let generandoPDF = false;
    
    // Asignar la función profesional de generación de PDF NATIVO
    btnGenerarPDF.addEventListener('click', generarPDFNativo);

    // Función para parsear fechas
    function parseDate(dateString) { 
        if (!dateString) return null; 
        const parts = dateString.split('-'); 
        return new Date(parts[0], parts[1] - 1, parts[2]); 
    }

    // Función principal de cálculo y visualización
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
            otrosIngresos: parseFloat(document.getElementById('otrosIngresos').value) || 0,
            deduccionInventario: parseFloat(document.getElementById('deduccionInventario').value) || 0,
            otrasDeducciones: parseFloat(document.getElementById('otrasDeducciones').value) || 0,
            aplicarINSS: document.getElementById('aplicarINSS').checked,
            aplicarIR: document.getElementById('aplicarIR').checked,
            elaboradoPor: document.getElementById('elaboradoPor').value.toUpperCase(),
            revisadoPor: document.getElementById('revisadoPor').value.toUpperCase(),
            autorizadoPor: document.getElementById('autorizadoPor').value.toUpperCase(),
        };
        
        // Validaciones
        if (!data.nombreEmpresa || !data.nombreEmpleado || !data.cedula || !data.puesto) {
            alert('Por favor, complete todos los campos obligatorios.');
            return;
        }
        
        if (data.fechaSalida < data.fechaIngreso) { 
            alert('La fecha de salida no puede ser anterior a la fecha de ingreso.'); 
            return; 
        }
        
        if (data.salarioMensual <= 0) {
            alert('El salario mensual debe ser mayor a cero.');
            return;
        }

        // --- Cálculos de Ingresos y Prestaciones ---
        const salarioDiario = data.salarioMensual / 30;
        const sueldoPendienteMonto = salarioDiario * data.sueldoPendienteDias;
        
        let fechaFinSueldoPendiente = null;
        if (data.fechaInicioSueldoPendiente && data.sueldoPendienteDias > 0) {
            fechaFinSueldoPendiente = new Date(data.fechaInicioSueldoPendiente.getTime());
            fechaFinSueldoPendiente.setDate(fechaFinSueldoPendiente.getDate() + data.sueldoPendienteDias - 1);
        }
        
        const tiempoTotalServicio = calcularTiempoServicio(data.fechaIngreso, data.fechaSalida);
        
        // Cálculo de Aguinaldo
        let fechaInicioAguinaldo;
        const primeroDiciembreAnterior = new Date(data.fechaSalida.getFullYear(), 11, 1);
        if (data.fechaSalida.getMonth() < 11) { 
            primeroDiciembreAnterior.setFullYear(data.fechaSalida.getFullYear() - 1); 
        }
        fechaInicioAguinaldo = (data.fechaIngreso < primeroDiciembreAnterior) ? primeroDiciembreAnterior : data.fechaIngreso;
        
        const tiempoAguinaldo = calcularTiempoServicio(fechaInicioAguinaldo, data.fechaSalida);
        const mesesParaAguinaldo = tiempoAguinaldo.years * 12 + tiempoAguinaldo.months + (tiempoAguinaldo.days / 30);
        const aguinaldoProporcional = (data.salarioMensual / 12) * mesesParaAguinaldo;
        
        // Cálculo de Vacaciones
        const totalMesesTrabajados = tiempoTotalServicio.years * 12 + tiempoTotalServicio.months + (tiempoTotalServicio.days / 30);
        const diasVacacionesGanadas = totalMesesTrabajados * 2.5;
        const vacacionesMonto = salarioDiario * data.vacacionesPendientes;
        
        // Cálculo de Indemnización
        let indemnizacionMonto = 0;
        if (data.motivoRetiroValue === 'despido_injustificado') {
            let diasIndemnizacion = 0;
            if (tiempoTotalServicio.years < 3) { 
                diasIndemnizacion = (tiempoTotalServicio.years * 30) + (tiempoTotalServicio.months * 2.5) + (tiempoTotalServicio.days / 30 * 2.5);
            } else { 
                diasIndemnizacion = (3 * 30) + ((tiempoTotalServicio.years - 3) * 20) + (tiempoTotalServicio.months * (20 / 12)) + (tiempoTotalServicio.days * (20 / 12 / 30));
            }
            indemnizacionMonto = Math.min(150, diasIndemnizacion) * salarioDiario;
        }

        // Total de ingresos brutos
        const totalIngresosBrutos = sueldoPendienteMonto + aguinaldoProporcional + vacacionesMonto + indemnizacionMonto + data.otrosIngresos;
        
        // Deducciones
        const baseCalculoDeducciones = sueldoPendienteMonto + vacacionesMonto + data.otrosIngresos;
        let deduccionINSS = data.aplicarINSS ? baseCalculoDeducciones * 0.07 : 0;
        let deduccionIR = 0;
        
        const totalDeducciones = deduccionINSS + deduccionIR + data.deduccionInventario + data.otrasDeducciones;
        
        // Neto
        const netoAPagar = totalIngresosBrutos - totalDeducciones;
        const cantidadEnLetras = numeroALetras(netoAPagar);
        
        // Funciones de formato
        const f = (n) => n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatDate = (d) => d ? d.toLocaleDateString('es-NI', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
        
        // Almacenar datos para el PDF nativo
        window.datosLiquidacion = {
            ...data,
            salarioDiario,
            sueldoPendienteMonto,
            fechaFinSueldoPendiente,
            tiempoTotalServicio,
            fechaInicioAguinaldo,
            tiempoAguinaldo,
            aguinaldoProporcional,
            totalMesesTrabajados,
            diasVacacionesGanadas,
            vacacionesMonto,
            indemnizacionMonto,
            totalIngresosBrutos,
            deduccionINSS,
            deduccionIR,
            totalDeducciones,
            netoAPagar,
            cantidadEnLetras,
            formatDate,
            f
        };
        
        // Generar HTML para vista previa
        pdfContent.innerHTML = `
            <div class="pdf-header">
                <h2>${data.nombreEmpresa}</h2>
                <p>LIQUIDACION FINAL DE PRESTACIONES LABORALES</p>
                <p>En Córdobas Netos (C$)</p>
            </div>
            
            <table class="info-table">
                <tr><td class="label">FECHA DE ELABORACION</td><td class="value">${formatDate(data.fechaElaboracion)}</td></tr>
                <tr><td class="label">FECHA DE INGRESO</td><td class="value">${formatDate(data.fechaIngreso)}</td></tr>
                <tr><td class="label">FECHA DE SALIDA</td><td class="value">${formatDate(data.fechaSalida)}</td></tr>
                <tr><td class="label">TIEMPO TOTAL DE SERVICIO</td><td class="value">${tiempoTotalServicio.years} años, ${tiempoTotalServicio.months} meses, ${tiempoTotalServicio.days} días</td></tr>
                <tr><td class="label">NOMBRE DEL EMPLEADO</td><td class="value">${data.nombreEmpleado}</td></tr>
                <tr><td class="label">CEDULA DE IDENTIDAD</td><td class="value">${data.cedula}</td></tr>
                <tr><td class="label">MOTIVO DE RETIRO</td><td class="value">${data.motivoRetiro}</td></tr>
                <tr><td class="label">PUESTO</td><td class="value">${data.puesto}</td></tr>
                <tr><td class="label">SALARIO MENSUAL</td><td class="value">C$ ${f(data.salarioMensual)} (Diario: C$ ${salarioDiario.toFixed(2)})</td></tr>
            </table>
            
            <div class="section-title">DETALLE DE LIQUIDACION</div>
            <table class="prestaciones-table">
                <thead><tr><th>CONCEPTO</th><th>DIAS</th><th>MONTO C$</th></tr></thead>
                <tbody>
                    <tr><td>SUELDO PENDIENTE</td><td>${data.sueldoPendienteDias}</td><td class="monto">${f(sueldoPendienteMonto)}</td></tr>
                    ${data.otrosIngresos > 0 ? `<tr><td>VIATICOS</td><td>-</td><td class="monto">${f(data.otrosIngresos)}</td></tr>` : ''}
                    <tr><td>AGUINALDO (Art. 93 CT)</td><td>-</td><td class="monto">${f(aguinaldoProporcional)}</td></tr>
                    <tr><td>VACACIONES (Art. 78 CT)</td><td>${data.vacacionesPendientes}</td><td class="monto">${f(vacacionesMonto)}</td></tr>
                    ${indemnizacionMonto > 0 ? `<tr><td>INDEMNIZACION (Art. 45 CT)</td><td>-</td><td class="monto">${f(indemnizacionMonto)}</td></tr>` : ''}
                </tbody>
            </table>
            
            <table class="totales-table">
                <tr><td class="label">TOTAL INGRESOS BRUTOS</td><td class="value">C$ ${f(totalIngresosBrutos)}</td></tr>
                ${deduccionINSS > 0 ? `<tr><td class="label">INSS (7%)</td><td class="value">C$ ${f(deduccionINSS)}</td></tr>` : ''}
                ${data.deduccionInventario > 0 ? `<tr><td class="label">FALTANTE INVENTARIO</td><td class="value">C$ ${f(data.deduccionInventario)}</td></tr>` : ''}
                ${data.otrasDeducciones > 0 ? `<tr><td class="label">OTRAS DEDUCCIONES</td><td class="value">C$ ${f(data.otrasDeducciones)}</td></tr>` : ''}
                <tr class="total-row"><td class="label">NETO A RECIBIR</td><td class="value">C$ ${f(netoAPagar)}</td></tr>
            </table>
            
            <table class="letras-table"><tr><td class="label">CANTIDAD EN LETRAS</td><td class="value">${cantidadEnLetras}</td></tr></table>
            
            <div class="texto-finiquito">
                <p>Por este medio recibo de <strong>${data.nombreEmpresa}</strong>, mi liquidación final a entera satisfacción, dando por finalizada la relación laboral.</p>
            </div>
            
            <table class="firmas-table">
                <tr><td><div class="firma-block">ELABORADO POR<br>${data.elaboradoPor}</div></td><td><div class="firma-block">RECIBI CONFORME<br>${data.nombreEmpleado}</div></td></tr>
                <tr><td><div class="firma-block">REVISADO POR<br>${data.revisadoPor}</div></td><td><div class="firma-block">AUTORIZADO POR<br>${data.autorizadoPor}</div></td></tr>
            </table>
        `;
        
        modal.style.display = 'block';
    }
    
    // FUNCIÓN PROFESIONAL: Genera PDF con TEXTO NATIVO (no imagen)
    async function generarPDFNativo() {
        if (generandoPDF || !window.datosLiquidacion) {
            return;
        }
        
        const btnPDF = document.getElementById('btnGenerarPDF');
        const textoOriginal = btnPDF.textContent;
        const d = window.datosLiquidacion;
        
        try {
            generandoPDF = true;
            btnPDF.textContent = '⏳ Generando PDF...';
            btnPDF.disabled = true;
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Configuración de página
            const marginX = 15;
            const marginY = 20;
            let y = marginY;
            const pageWidth = 210;
            const contentWidth = pageWidth - (marginX * 2);
            
            // Fuentes y estilos
            pdf.setFont('helvetica', 'normal');
            
            // === ENCABEZADO ===
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(d.nombreEmpresa, pageWidth / 2, y, { align: 'center' });
            y += 6;
            
            pdf.setFontSize(11);
            pdf.text('LIQUIDACION FINAL DE PRESTACIONES LABORALES', pageWidth / 2, y, { align: 'center' });
            y += 5;
            
            pdf.setFontSize(10);
            pdf.text('En Córdobas Netos (C$)', pageWidth / 2, y, { align: 'center' });
            y += 8;
            
            // === LÍNEA SEPARADORA ===
            pdf.line(marginX, y, pageWidth - marginX, y);
            y += 6;
            
            // === INFORMACIÓN GENERAL ===
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('DATOS GENERALES', marginX, y);
            y += 5;
            
            pdf.setFont('helvetica', 'normal');
            const infoLines = [
                `FECHA DE ELABORACION: ${d.formatDate(d.fechaElaboracion)}`,
                `FECHA DE INGRESO: ${d.formatDate(d.fechaIngreso)}`,
                `FECHA DE SALIDA: ${d.formatDate(d.fechaSalida)}`,
                `TIEMPO DE SERVICIO: ${d.tiempoTotalServicio.years} años, ${d.tiempoTotalServicio.months} meses, ${d.tiempoTotalServicio.days} dias`,
                `EMPLEADO: ${d.nombreEmpleado}`,
                `CEDULA: ${d.cedula}`,
                `MOTIVO: ${d.motivoRetiro}`,
                `PUESTO: ${d.puesto}`,
                `SALARIO MENSUAL: C$ ${d.f(d.salarioMensual)} (Diario: C$ ${d.salarioDiario.toFixed(2)})`
            ];
            
            for (const line of infoLines) {
                pdf.text(line, marginX, y);
                y += 5;
                if (y > 270) {
                    pdf.addPage();
                    y = marginY;
                }
            }
            
            y += 3;
            pdf.line(marginX, y, pageWidth - marginX, y);
            y += 6;
            
            // === DETALLE DE LIQUIDACIÓN ===
            pdf.setFont('helvetica', 'bold');
            pdf.text('DETALLE DE LIQUIDACION', marginX, y);
            y += 6;
            
            // Tabla de ingresos
            pdf.setFont('helvetica', 'bold');
            pdf.text('INGRESOS:', marginX, y);
            y += 5;
            
            pdf.setFont('helvetica', 'normal');
            const ingresos = [
                { concepto: 'SUELDO PENDIENTE', dias: d.sueldoPendienteDias, monto: d.sueldoPendienteMonto },
                ...(d.otrosIngresos > 0 ? [{ concepto: 'VIATICOS', dias: '-', monto: d.otrosIngresos }] : []),
                { concepto: 'AGUINALDO (Art. 93 CT)', dias: '-', monto: d.aguinaldoProporcional },
                { concepto: 'VACACIONES (Art. 78 CT)', dias: d.vacacionesPendientes, monto: d.vacacionesMonto }
            ];
            
            if (d.indemnizacionMonto > 0) {
                ingresos.push({ concepto: 'INDEMNIZACION (Art. 45 CT)', dias: '-', monto: d.indemnizacionMonto });
            }
            
            for (const item of ingresos) {
                pdf.text(`• ${item.concepto}: ${item.dias !== '-' ? item.dias + ' dias' : ''}`, marginX, y);
                pdf.text(`C$ ${d.f(item.monto)}`, pageWidth - marginX - 30, y);
                y += 5;
                if (y > 270) {
                    pdf.addPage();
                    y = marginY;
                }
            }
            
            y += 3;
            pdf.line(marginX, y, pageWidth - marginX, y);
            y += 5;
            
            // === TOTALES ===
            pdf.setFont('helvetica', 'bold');
            pdf.text('RESUMEN DE LIQUIDACION', marginX, y);
            y += 6;
            
            pdf.setFont('helvetica', 'normal');
            pdf.text(`TOTAL INGRESOS BRUTOS:`, marginX, y);
            pdf.text(`C$ ${d.f(d.totalIngresosBrutos)}`, pageWidth - marginX - 30, y);
            y += 5;
            
            if (d.deduccionINSS > 0) {
                pdf.text(`(-) INSS LABORAL (7%):`, marginX, y);
                pdf.text(`C$ ${d.f(d.deduccionINSS)}`, pageWidth - marginX - 30, y);
                y += 5;
            }
            
            if (d.deduccionInventario > 0) {
                pdf.text(`(-) FALTANTE INVENTARIO:`, marginX, y);
                pdf.text(`C$ ${d.f(d.deduccionInventario)}`, pageWidth - marginX - 30, y);
                y += 5;
            }
            
            if (d.otrasDeducciones > 0) {
                pdf.text(`(-) OTRAS DEDUCCIONES:`, marginX, y);
                pdf.text(`C$ ${d.f(d.otrasDeducciones)}`, pageWidth - marginX - 30, y);
                y += 5;
            }
            
            y += 3;
            pdf.line(marginX, y, pageWidth - marginX, y);
            y += 5;
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text(`NETO A RECIBIR:`, marginX, y);
            pdf.text(`C$ ${d.f(d.netoAPagar)}`, pageWidth - marginX - 30, y);
            y += 7;
            
            pdf.setFontSize(9);
            pdf.text(`CANTIDAD EN LETRAS: ${d.cantidadEnLetras}`, marginX, y);
            y += 10;
            
            // === TEXTO DE FINIQUITO ===
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const finiquito = `Por este medio recibo de ${d.nombreEmpresa}, mi liquidacion final a entera satisfaccion, 
dando por finalizada la relacion laboral en todas sus partes. Declaro no tener nada mas que reclamar.`;
            pdf.text(finiquito, marginX, y, { maxWidth: contentWidth });
            y += 15;
            
            // === FIRMAS ===
            if (y > 250) {
                pdf.addPage();
                y = marginY;
            }
            
            pdf.line(marginX, y, pageWidth - marginX, y);
            y += 5;
            
            const firmaWidth = (contentWidth - 10) / 2;
            pdf.text('ELABORADO POR:', marginX, y);
            pdf.text(d.elaboradoPor, marginX, y + 5);
            pdf.text(d.formatDate(d.fechaElaboracion), marginX, y + 10);
            
            pdf.text('RECIBI CONFORME:', marginX + firmaWidth + 10, y);
            pdf.text(d.nombreEmpleado, marginX + firmaWidth + 10, y + 5);
            pdf.text(d.cedula, marginX + firmaWidth + 10, y + 10);
            
            y += 20;
            
            pdf.text('REVISADO POR:', marginX, y);
            pdf.text(d.revisadoPor, marginX, y + 5);
            
            pdf.text('AUTORIZADO POR:', marginX + firmaWidth + 10, y);
            pdf.text(d.autorizadoPor, marginX + firmaWidth + 10, y + 5);
            
            // === NUMERACIÓN DE PÁGINA ===
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(7);
                pdf.setTextColor(128);
                pdf.text(`Pagina ${i} de ${pageCount}`, pageWidth / 2, 287, { align: 'center' });
                pdf.setTextColor(0);
            }
            
            // Guardar PDF
            const fecha = new Date();
            const nombreArchivo = `Liquidacion_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.pdf`;
            pdf.save(nombreArchivo);
            
        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF. Se abrirá la ventana de impresión.');
            imprimirVentanaNavegador();
        } finally {
            generandoPDF = false;
            btnPDF.textContent = textoOriginal;
            btnPDF.disabled = false;
        }
    }
    
    // Función de respaldo (ventana de impresión)
    function imprimirVentanaNavegador() {
        const contenidoParaImprimir = document.getElementById('pdf-content').innerHTML;
        const estilos = document.querySelector('link[href="style.css"]');
        const ventanaImpresion = window.open('', '_blank', 'width=800,height=600,toolbar=yes,menubar=yes,scrollbars=yes');
        
        if (!ventanaImpresion) {
            alert('Por favor, permite las ventanas emergentes para esta página');
            return;
        }
        
        ventanaImpresion.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Comprobante de Liquidación</title>
                    <meta charset="UTF-8">
                    ${estilos ? estilos.outerHTML : ''}
                    <style>
                        body { margin: 20px; padding: 20px; background: white; font-family: Arial, sans-serif; }
                        .btn-pdf, .close-button { display: none !important; }
                        @media print { body { margin: 0; padding: 0; } }
                    </style>
                </head>
                <body>${contenidoParaImprimir}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300)};<\/script></body>
            </html>
        `);
        ventanaImpresion.document.close();
    }

    function calcularTiempoServicio(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return { years: 0, months: 0, days: 0 };
        let inicio = new Date(fechaInicio.getTime());
        let fin = new Date(fechaFin.getTime());
        let anios = fin.getFullYear() - inicio.getFullYear();
        let meses = fin.getMonth() - inicio.getMonth();
        let dias = fin.getDate() - inicio.getDate();
        if (dias < 0) { meses--; dias += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate(); }
        if (meses < 0) { anios--; meses += 12; }
        return { years: anios, months: meses, days: dias };
    }
    
    function numeroALetras(num) {
        const Unidades = (n) => {
            switch(n) {
                case 1: return "UN"; case 2: return "DOS"; case 3: return "TRES";
                case 4: return "CUATRO"; case 5: return "CINCO"; case 6: return "SEIS";
                case 7: return "SIETE"; case 8: return "OCHO"; case 9: return "NUEVE";
                default: return "";
            }
        };
        
        const Decenas = (n) => {
            let a = Math.floor(n / 10);
            let r = n - (10 * a);
            switch(a) {
                case 1:
                    switch(r) {
                        case 0: return "DIEZ"; case 1: return "ONCE"; case 2: return "DOCE";
                        case 3: return "TRECE"; case 4: return "CATORCE"; case 5: return "QUINCE";
                        default: return "DIECI" + Unidades(r);
                    }
                case 2: return r === 0 ? "VEINTE" : "VEINTI" + Unidades(r);
                case 3: return r > 0 ? "TREINTA Y " + Unidades(r) : "TREINTA";
                case 4: return r > 0 ? "CUARENTA Y " + Unidades(r) : "CUARENTA";
                case 5: return r > 0 ? "CINCUENTA Y " + Unidades(r) : "CINCUENTA";
                case 6: return r > 0 ? "SESENTA Y " + Unidades(r) : "SESENTA";
                case 7: return r > 0 ? "SETENTA Y " + Unidades(r) : "SETENTA";
                case 8: return r > 0 ? "OCHENTA Y " + Unidades(r) : "OCHENTA";
                case 9: return r > 0 ? "NOVENTA Y " + Unidades(r) : "NOVENTA";
                default: return Unidades(r);
            }
        };
        
        const Centenas = (n) => {
            let r = Math.floor(n / 100);
            let t = n - (100 * r);
            switch(r) {
                case 1: return t > 0 ? "CIENTO " + Decenas(t) : "CIEN";
                case 2: return "DOSCIENTOS " + Decenas(t);
                case 3: return "TRESCIENTOS " + Decenas(t);
                case 4: return "CUATROCIENTOS " + Decenas(t);
                case 5: return "QUINIENTOS " + Decenas(t);
                case 6: return "SEISCIENTOS " + Decenas(t);
                case 7: return "SETECIENTOS " + Decenas(t);
                case 8: return "OCHOCIENTOS " + Decenas(t);
                case 9: return "NOVECIENTOS " + Decenas(t);
                default: return Decenas(t);
            }
        };
        
        const Seccion = (num, divisor, strSingular, strPlural) => {
            let a = Math.floor(num / divisor);
            let o = num - (a * divisor);
            let result = "";
            if (a > 0) {
                result = a > 1 ? Centenas(a) + " " + strPlural : strSingular;
            }
            return result;
        };
        
        const Miles = (num) => {
            let divisor = 1000;
            let a = Math.floor(num / divisor);
            let n = num - (a * divisor);
            let str = Seccion(num, divisor, "UN MIL", "MIL");
            let centenas = Centenas(n);
            return str === "" ? centenas : str + " " + centenas;
        };
        
        const Millones = (num) => {
            let divisor = 1000000;
            let a = Math.floor(num / divisor);
            let n = num - (a * divisor);
            let str = Seccion(num, divisor, "UN MILLON DE", "MILLONES DE");
            let miles = Miles(n);
            return str === "" ? miles : str + " " + miles;
        };
        
        const enteros = Math.floor(num);
        const centavos = Math.round((num * 100)) - (enteros * 100);
        const letrasCentavos = centavos > 0 ? "CON " + centavos.toString().padStart(2, "0") + "/100" : "";
        
        if (enteros === 0) return "CERO CORDOBAS " + letrasCentavos;
        if (enteros === 1) return Millones(enteros) + " CORDOBA " + letrasCentavos;
        return Millones(enteros) + " CORDOBAS " + letrasCentavos;
    }
});
