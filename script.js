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
    
    // Asignar la función profesional de generación de PDF
    btnGenerarPDF.addEventListener('click', imprimirLiquidacion);

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
        
        // Validación básica
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
        
        // Cálculo de Aguinaldo proporcional (Art. 93 CT)
        let fechaInicioAguinaldo;
        const primeroDiciembreAnterior = new Date(data.fechaSalida.getFullYear(), 11, 1);
        if (data.fechaSalida.getMonth() < 11) { 
            primeroDiciembreAnterior.setFullYear(data.fechaSalida.getFullYear() - 1); 
        }
        fechaInicioAguinaldo = (data.fechaIngreso < primeroDiciembreAnterior) ? primeroDiciembreAnterior : data.fechaIngreso;
        
        const tiempoAguinaldo = calcularTiempoServicio(fechaInicioAguinaldo, data.fechaSalida);
        const mesesParaAguinaldo = tiempoAguinaldo.years * 12 + tiempoAguinaldo.months + (tiempoAguinaldo.days / 30);
        const aguinaldoProporcional = (data.salarioMensual / 12) * mesesParaAguinaldo;
        
        // Cálculo de Vacaciones (Art. 78 CT)
        const totalMesesTrabajados = tiempoTotalServicio.years * 12 + tiempoTotalServicio.months + (tiempoTotalServicio.days / 30);
        const diasVacacionesGanadas = totalMesesTrabajados * 2.5;
        const diasVacacionesGozadas = Math.max(0, diasVacacionesGanadas - data.vacacionesPendientes);
        const vacacionesMonto = salarioDiario * data.vacacionesPendientes;
        
        // Cálculo de Indemnización (Art. 45 CT)
        let indemnizacionMonto = 0;
        if (data.motivoRetiroValue !== 'renuncia_sin_preaviso' && data.motivoRetiroValue !== 'despido_justificado') {
            let diasIndemnizacion = 0;
            if (tiempoTotalServicio.years < 3) { 
                diasIndemnizacion = (tiempoTotalServicio.years * 30) + (tiempoTotalServicio.months * (30 / 12)) + (tiempoTotalServicio.days * (30 / 12 / 30)); 
            } else { 
                diasIndemnizacion = (3 * 30) + ((tiempoTotalServicio.years - 3) * 20) + (tiempoTotalServicio.months * (20 / 12)) + (tiempoTotalServicio.days * (20 / 12 / 30)); 
            }
            indemnizacionMonto = Math.min(150, diasIndemnizacion) * salarioDiario;
        }

        // Total de ingresos brutos (incluye otros ingresos)
        const totalIngresosBrutos = sueldoPendienteMonto + aguinaldoProporcional + vacacionesMonto + indemnizacionMonto + data.otrosIngresos;
        
        // --- Cálculos de Deducciones ---
        const baseCalculoDeducciones = sueldoPendienteMonto + vacacionesMonto + data.otrosIngresos;
        let deduccionINSS = data.aplicarINSS ? baseCalculoDeducciones * 0.07 : 0;
        let deduccionIR = 0; // IR simplificado - en producción se debe implementar la tabla completa
        
        const totalDeducciones = deduccionINSS + deduccionIR + data.deduccionInventario + data.otrasDeducciones;
        
        // --- Cálculo Final ---
        const netoAPagar = totalIngresosBrutos - totalDeducciones;
        const cantidadEnLetras = numeroALetras(netoAPagar);
        
        // Funciones de formato
        const f = (n) => n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatDate = (d) => d ? d.toLocaleDateString('es-NI', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
        
        // Generar HTML del comprobante
        pdfContent.innerHTML = `
            <div class="pdf-header">
                <h2>${data.nombreEmpresa}</h2>
                <p>LIQUIDACION FINAL DE PRESTACIONES LABORALES</p>
                <p>En Córdobas Netos (C$)</p>
            </div>
            
            <table class="info-table">
                <tr><td class="label">FECHA DE ELABORACION DE LA LIQUIDACIÓN</td><td class="value">${formatDate(data.fechaElaboracion)}</td></tr>
                <tr><td class="label">FECHA DE INGRESO</td><td class="value">${formatDate(data.fechaIngreso)}</td></tr>
                <tr><td class="label">FECHA DE SALIDA</td><td class="value">${formatDate(data.fechaSalida)}</td></tr>
                <tr><td class="label">TIEMPO TOTAL DE SERVICIO</td><td class="value">${tiempoTotalServicio.years} años, ${tiempoTotalServicio.months} meses, ${tiempoTotalServicio.days} días</td></tr>
                <tr><td class="label">NOMBRE DEL EMPLEADO</td><td class="value">${data.nombreEmpleado}</td></tr>
                <tr><td class="label">CEDULA DE IDENTIDAD</td><td class="value">${data.cedula}</td></tr>
                <tr><td class="label">MOTIVO DE RETIRO</td><td class="value">${data.motivoRetiro}</td></tr>
                <tr><td class="label">TIPO DE CONTRATO</td><td class="value">${data.tipoContrato}</td></tr>
                <tr><td class="label">TIPO DE SALARIO</td><td class="value">${data.tipoSalario}</td></tr>
                <tr><td class="label">PUESTO (CARGO DESEMPEÑADO)</td><td class="value">${data.puesto}</td></tr>
                <tr><td class="label">SALARIO ORDINARIO MENSUAL</td><td class="value">C$ ${f(data.salarioMensual)}<br><span class="sub-value">SUELDO DIARIO: C$ ${salarioDiario.toFixed(5)}</span><br><span class="sub-value">SUELDO POR HORA: C$ ${(salarioDiario / 8).toFixed(4)}</span></td></tr>
            </table>
            
            <div class="section-title">DETALLE DE INGRESOS</div>
            <table class="prestaciones-table">
                <thead>
                    <tr>
                        <th class="concepto">CONCEPTO</th>
                        <th>DEL</th>
                        <th>AL</th>
                        <th>DIAS</th>
                        <th>MESES</th>
                        <th>AÑOS</th>
                        <th>DIAS A FAVOR<br><span class="sub-header">(2.5 POR MES)</span></th>
                        <th>DIAS A PAGAR</th>
                        <th class="monto">MONTO C$</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="concepto">SUELDO PENDIENTE</td>
                        <td>${formatDate(data.fechaInicioSueldoPendiente)}</td>
                        <td>${formatDate(fechaFinSueldoPendiente)}</td>
                        <td>${data.sueldoPendienteDias}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${data.sueldoPendienteDias}</td>
                        <td class="monto">${f(sueldoPendienteMonto)}</td>
                    </tr>
                    ${data.otrosIngresos > 0 ? `
                    <tr>
                        <td class="concepto">VIATICOS (Transporte, Alimentación, Hospedaje)</td>
                        <td colspan="7">Monto fijo</td>
                        <td class="monto">${f(data.otrosIngresos)}</td>
                    </tr>` : ''}
                    <tr>
                        <td class="concepto">AGUINALDO<br><span class="sub-header">(Art. 93 CT)</span></td>
                        <td>${formatDate(fechaInicioAguinaldo)}</td>
                        <td>${formatDate(data.fechaSalida)}</td>
                        <td>${tiempoAguinaldo.days}</td>
                        <td>${tiempoAguinaldo.months}</td>
                        <td>${tiempoAguinaldo.years}</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="monto">${f(aguinaldoProporcional)}</td>
                    </tr>
                    <tr>
                        <td class="concepto">VACACIONES<br><span class="sub-header">(Art. 78 CT)</span></td>
                        <td>${formatDate(data.fechaIngreso)}</td>
                        <td>${formatDate(data.fechaSalida)}</td>
                        <td>${tiempoTotalServicio.days}</td>
                        <td>${tiempoTotalServicio.months}</td>
                        <td>${tiempoTotalServicio.years}</td>
                        <td>${diasVacacionesGanadas.toFixed(2)}</td>
                        <td>${data.vacacionesPendientes.toFixed(2)}</td>
                        <td class="monto">${f(vacacionesMonto)}</td>
                    </tr>
                    <tr>
                        <td class="concepto">INDEMNIZACION<br><span class="sub-header">(Art. 45 CT)</span></td>
                        <td colspan="5">Por tiempo de servicio</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="monto">${f(indemnizacionMonto)}</td>
                    </tr>
                </tbody>
            </table>
            
            <table class="totales-table">
                <tr><td class="label">TOTAL DE INGRESOS BRUTOS</td><td class="value">C$ ${f(totalIngresosBrutos)}</td></tr>
                <tr><td class="label">MENOS DEDUCCIONES:</td><td class="value">C$ ${f(totalDeducciones)}</td></tr>
                ${data.deduccionInventario > 0 ? `<tr><td class="label">- FALTANTE DE INVENTARIO</td><td class="value">C$ ${f(data.deduccionInventario)}</td></tr>` : ''}
                ${data.otrasDeducciones > 0 ? `<tr><td class="label">- OTRAS DEDUCCIONES</td><td class="value">C$ ${f(data.otrasDeducciones)}</td></tr>` : ''}
                ${deduccionINSS > 0 ? `<tr><td class="label">- INSS LABORAL (7%)</td><td class="value">C$ ${f(deduccionINSS)}</td></tr>` : ''}
                <tr class="total-row"><td class="label">NETO A RECIBIR</td><td class="value">C$ ${f(netoAPagar)}</td></tr>
            </table>
            
            <table class="letras-table">
                <tr><td class="label">CANTIDAD EN LETRAS:</td><td class="value">${cantidadEnLetras}</td></tr>
            </table>
            
            <div class="texto-finiquito">
                <p>Por este medio hago constar que recibo de <strong>${data.nombreEmpresa}</strong>, mi liquidación final a mi entera satisfacción, correspondiente a las prestaciones sociales y demás derechos que me corresponden según el Código del Trabajo de Nicaragua. Declaro que no tengo nada más que reclamar al EMPLEADOR por concepto de derechos laborales, dando por finalizada la relación laboral en todas sus partes.</p>
            </div>
            
            <table class="firmas-table">
                <tr>
                    <td><div class="firma-block"><div class="label">ELABORADO POR:</div><div class="name">${data.elaboradoPor}</div><div class="date">${formatDate(data.fechaElaboracion)}</div></div></td>
                    <td><div class="firma-block"><div class="label">REVISADO POR:</div><div class="name">${data.revisadoPor}</div></div></td>
                </tr>
                <tr>
                    <td><div class="firma-block"><div class="label">RECIBI CONFORME:</div><div class="name">${data.nombreEmpleado}</div><div class="id">${data.cedula}</div></div></td>
                    <td><div class="firma-block"><div class="label">AUTORIZADO POR:</div><div class="name">${data.autorizadoPor}</div></div></td>
                </tr>
            </table>
        `;
        
        modal.style.display = 'block';
    }
    
    // Función profesional para generar PDF con escala dinámica (prioriza 1 página)
    async function imprimirLiquidacion() {
        // Evitar múltiples generaciones simultáneas
        if (generandoPDF) {
            return;
        }
        
        const btnPDF = document.getElementById('btnGenerarPDF');
        const textoOriginal = btnPDF.textContent;
        
        try {
            generandoPDF = true;
            btnPDF.textContent = '⏳ Generando PDF...';
            btnPDF.disabled = true;
            btnPDF.style.opacity = '0.7';
            btnPDF.style.cursor = 'wait';
            
            // Obtener el elemento a convertir
            const elemento = document.getElementById('pdf-content');
            
            // Medir el contenido para saber si cabe en una página
            const contenidoHeight = elemento.scrollHeight;
            const contenidoWidth = elemento.scrollWidth;
            
            // Configuración del PDF (tamaño A4)
            const { jsPDF } = window.jspdf;
            
            // Márgenes profesionales (en mm)
            const marginTop = 15;
            const marginBottom = 15;
            const marginLeft = 15;
            const marginRight = 15;
            
            // Dimensiones de la página A4 en mm
            const pageWidthMM = 210;
            const pageHeightMM = 297;
            
            // Ancho y alto disponible para el contenido (restando márgenes)
            const availableWidthMM = pageWidthMM - marginLeft - marginRight;
            const availableHeightMM = pageHeightMM - marginTop - marginBottom;
            
            // Calcular escala necesaria para que el contenido quepa horizontalmente (1px = 0.352778mm en 96dpi)
            const horizontalScale = availableWidthMM / (contenidoWidth * 0.352778);
            
            // Calcular cuánto espacio vertical ocuparía con esa escala
            const estimatedHeightMM = (contenidoHeight * 0.352778) * horizontalScale;
            
            // Determinar si cabe en una página (con tolerancia de 10mm)
            const cabeEnUnaPagina = estimatedHeightMM <= availableHeightMM + 10;
            
            let scale = horizontalScale;
            let usarMultiPagina = false;
            
            if (!cabeEnUnaPagina) {
                // Si no cabe, calcular la escala máxima para que quepa exactamente
                const escalaPorAltura = availableHeightMM / (contenidoHeight * 0.352778);
                scale = Math.min(horizontalScale, escalaPorAltura);
                
                const finalHeightMM = (contenidoHeight * 0.352778) * scale;
                
                if (finalHeightMM > availableHeightMM + 5) {
                    usarMultiPagina = true;
                    scale = Math.min(horizontalScale, 1.2);
                }
            }
            
            // Capturar el elemento con la escala calculada
            const canvas = await html2canvas(elemento, {
                scale: Math.min(scale * 1.5, 3),
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: false,
                windowWidth: elemento.scrollWidth,
                windowHeight: elemento.scrollHeight
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            
            if (!usarMultiPagina) {
                // === MODO UNA PÁGINA ===
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const imgWidthMM = availableWidthMM;
                const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
                
                // Centrar verticalmente
                let verticalOffset = marginTop;
                if (imgHeightMM < availableHeightMM) {
                    verticalOffset = marginTop + (availableHeightMM - imgHeightMM) / 2;
                }
                
                pdf.addImage(imgData, 'PNG', marginLeft, verticalOffset, imgWidthMM, imgHeightMM);
                
                // Numeración
                pdf.setFontSize(8);
                pdf.setTextColor(100, 100, 100);
                pdf.text('Página 1 de 1', 105, pageHeightMM - 8, { align: 'center' });
                
                const fecha = new Date();
                const nombreArchivo = `Liquidacion_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.pdf`;
                pdf.save(nombreArchivo);
                
            } else {
                // === MODO MÚLTIPLES PÁGINAS ===
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const imgWidthMM = availableWidthMM;
                const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
                
                let heightLeft = imgHeightMM;
                let currentPosition = 0;
                let pageNumber = 1;
                
                pdf.addImage(imgData, 'PNG', marginLeft, marginTop - currentPosition, imgWidthMM, imgHeightMM);
                heightLeft -= availableHeightMM;
                currentPosition += availableHeightMM;
                
                while (heightLeft > 5) {
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', marginLeft, marginTop - currentPosition, imgWidthMM, imgHeightMM);
                    heightLeft -= availableHeightMM;
                    currentPosition += availableHeightMM;
                    pageNumber++;
                }
                
                for (let i = 1; i <= pageNumber; i++) {
                    pdf.setPage(i);
                    pdf.setFontSize(8);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(`Página ${i} de ${pageNumber}`, 105, pageHeightMM - 8, { align: 'center' });
                }
                
                const fecha = new Date();
                const nombreArchivo = `Liquidacion_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.pdf`;
                pdf.save(nombreArchivo);
            }
            
        } catch (error) {
            console.error('Error al generar PDF:', error);
            const usarImpresion = confirm('No se pudo generar el PDF automáticamente. ¿Deseas abrir la ventana de impresión?');
            if (usarImpresion) {
                imprimirVentanaNavegador();
            } else {
                alert('Puedes intentar nuevamente o usar Ctrl+P para imprimir');
            }
        } finally {
            generandoPDF = false;
            btnPDF.textContent = textoOriginal;
            btnPDF.disabled = false;
            btnPDF.style.opacity = '1';
            btnPDF.style.cursor = 'pointer';
        }
    }
    
    // Función de respaldo (ventana de impresión tradicional)
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
                        body { 
                            margin: 20px; 
                            padding: 20px; 
                            background: white;
                            font-family: Arial, sans-serif;
                        }
                        .btn-pdf, .close-button {
                            display: none !important;
                        }
                        @media print {
                            body {
                                margin: 0;
                                padding: 0;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${contenidoParaImprimir}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 300);
                        };
                    <\/script>
                </body>
            </html>
        `);
        
        ventanaImpresion.document.close();
    }

    // Función para calcular tiempo de servicio entre dos fechas
    function calcularTiempoServicio(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return { years: 0, months: 0, days: 0 };
        
        let inicio = new Date(fechaInicio.getTime());
        let fin = new Date(fechaFin.getTime());
        
        let anios = fin.getFullYear() - inicio.getFullYear();
        let meses = fin.getMonth() - inicio.getMonth();
        let dias = fin.getDate() - inicio.getDate();
        
        if (dias < 0) {
            meses--;
            dias += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate();
        }
        
        if (meses < 0) {
            anios--;
            meses += 12;
        }
        
        return { years: anios, months: meses, days: dias };
    }
    
    // Función para convertir números a letras
    function numeroALetras(num) {
        const Unidades = function(num) {
            switch(num) {
                case 1: return "UN";
                case 2: return "DOS";
                case 3: return "TRES";
                case 4: return "CUATRO";
                case 5: return "CINCO";
                case 6: return "SEIS";
                case 7: return "SIETE";
                case 8: return "OCHO";
                case 9: return "NUEVE";
                default: return "";
            }
        };
        
        const Decenas = function(num) {
            let a = Math.floor(num / 10);
            let r = num - (10 * a);
            
            switch(a) {
                case 1:
                    switch(r) {
                        case 0: return "DIEZ";
                        case 1: return "ONCE";
                        case 2: return "DOCE";
                        case 3: return "TRECE";
                        case 4: return "CATORCE";
                        case 5: return "QUINCE";
                        default: return "DIECI" + Unidades(r);
                    }
                case 2:
                    switch(r) {
                        case 0: return "VEINTE";
                        default: return "VEINTI" + Unidades(r);
                    }
                case 3: return DecenasY("TREINTA", r);
                case 4: return DecenasY("CUARENTA", r);
                case 5: return DecenasY("CINCUENTA", r);
                case 6: return DecenasY("SESENTA", r);
                case 7: return DecenasY("SETENTA", r);
                case 8: return DecenasY("OCHENTA", r);
                case 9: return DecenasY("NOVENTA", r);
                case 0: return Unidades(r);
                default: return "";
            }
        };
        
        function DecenasY(strNum, r) {
            return r > 0 ? strNum + " Y " + Unidades(r) : strNum;
        }
        
        function Centenas(num) {
            let r = Math.floor(num / 100);
            let t = num - (100 * r);
            
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
        }
        
        function Seccion(num, divisor, strSingular, strPlural) {
            let a = Math.floor(num / divisor);
            let o = num - (a * divisor);
            let result = "";
            
            if (a > 0) {
                result = a > 1 ? Centenas(a) + " " + strPlural : strSingular;
            }
            
            return result;
        }
        
        function Miles(num) {
            let divisor = 1000;
            let a = Math.floor(num / divisor);
            let n = num - (a * divisor);
            let str = Seccion(num, divisor, "UN MIL", "MIL");
            let centenas = Centenas(n);
            
            return str === "" ? centenas : str + " " + centenas;
        }
        
        function Millones(num) {
            let divisor = 1000000;
            let a = Math.floor(num / divisor);
            let n = num - (a * divisor);
            let str = Seccion(num, divisor, "UN MILLON DE", "MILLONES DE");
            let miles = Miles(n);
            
            return str === "" ? miles : str + " " + miles;
        }
        
        const currency = {
            plural: "CÓRDOBAS",
            singular: "CÓRDOBA"
        };
        
        const data = {
            numero: num,
            enteros: Math.floor(num),
            centavos: Math.round((num * 100)) - (Math.floor(num) * 100),
            letrasCentavos: "",
            letrasMonedaPlural: currency.plural,
            letrasMonedaSingular: currency.singular
        };
        
        if (data.centavos > 0) {
            data.letrasCentavos = "CON " + data.centavos.toString().padStart(2, "0") + "/100";
        }
        
        if (data.enteros === 0) {
            return "CERO " + data.letrasMonedaPlural + " " + data.letrasCentavos;
        }
        
        if (data.enteros === 1) {
            return Millones(data.enteros) + " " + data.letrasMonedaSingular + " " + data.letrasCentavos;
        }
        
        return Millones(data.enteros) + " " + data.letrasMonedaPlural + " " + data.letrasCentavos;
    }
});
