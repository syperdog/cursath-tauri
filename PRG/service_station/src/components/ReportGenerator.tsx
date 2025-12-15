import React, { useState } from 'react';
import './ReportGenerator.css';

const ReportGenerator: React.FC = () => {
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportColumns, setReportColumns] = useState<string[]>([]);

  const reportTypes = [
    { value: 'sales', label: 'Отчет по продажам' },
    { value: 'orders', label: 'Отчет по заказам' },
    { value: 'employees', label: 'Отчет по сотрудникам' },
    { value: 'inventory', label: 'Отчет по запасам' },
    { value: 'finances', label: 'Финансовый отчет' }
  ];

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      // Получаем данные для отчета
      const reportData = getReportData(reportType);
      setReportData(reportData.data);
      setReportColumns(reportData.columns);
    } catch (error) {
      console.error('Ошибка генерации отчета:', error);
      alert('Ошибка генерации отчета: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Функция для генерации данных отчета
  const getReportData = (type: string) => {
    // В реальной системе здесь будут получаться данные из базы данных
    // Сейчас используем базовые статические данные для демонстрации
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    switch(type) {
      case 'sales':
        return {
          columns: ['ID', 'Клиент', 'Услуга', 'Сумма', 'Дата'],
          data: [
            { ID: 1, Клиент: 'Иванов И.И.', Услуга: 'Диагностика', Сумма: 2500, Дата: formatDate(today) },
            { ID: 2, Клиент: 'Петров П.П.', Услуга: 'Замена масла', Сумма: 1800, Дата: formatDate(lastWeek) },
          ]
        };
      case 'orders':
        return {
          columns: ['ID', 'Клиент', 'Статус', 'Дата создания'],
          data: [
            { ID: 101, Клиент: 'Сидоров С.С.', Статус: 'В работе', Дата_создания: formatDate(today) },
            { ID: 102, Клиент: 'Козлов А.А.', Статус: 'Выполнен', Дата_создания: formatDate(lastWeek) },
          ]
        };
      case 'employees':
        return {
          columns: ['ID', 'ФИО', 'Роль'],
          data: [
            { ID: 1, ФИО: 'Мастеров Петр', Роль: 'Мастер-приемщик' },
            { ID: 2, ФИО: 'Диагностов Иван', Роль: 'Диагност' },
          ]
        };
      case 'inventory':
        return {
          columns: ['Наименование', 'Категория', 'В наличии'],
          data: [
            { Наименование: 'Масло моторное', Категория: 'Масла', В_наличии: 45 },
            { Наименование: 'Свечи зажигания', Категория: 'Расходники', В_наличии: 120 },
          ]
        };
      case 'finances':
        return {
          columns: ['Период', 'Доход', 'Расход', 'Прибыль'],
          data: [
            { Период: 'Текущий месяц', Доход: 85000, Расход: 45000, Прибыль: 40000 },
            { Период: 'Прошлый месяц', Доход: 78000, Расход: 42000, Прибыль: 36000 },
          ]
        };
      default:
        return { columns: [], data: [] };
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      alert('Нет данных для экспорта. Сначала сгенерируйте отчет.');
      return;
    }

    // Convert report data to CSV
    const csvContent = [
      reportColumns.join(','),
      ...reportData.map(row => reportColumns.map(col => `"${row[col] || ''}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    alert('Функция экспорта в PDF будет реализована в следующей версии.');
  };

  return (
    <div className="report-generator">
      <div className="report-controls">
        <div className="control-group">
          <label>Тип отчета:</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            {reportTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Период:</label>
          <div className="date-range">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            />
            <span> - </span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            />
          </div>
        </div>

        <button className="generate-btn" onClick={handleGenerateReport} disabled={loading}>
          {loading ? 'Генерация...' : 'Сформировать отчет'}
        </button>

        <div className="export-buttons">
          <button className="export-btn csv-export" onClick={handleExportCSV} disabled={reportData.length === 0}>
            Экспорт в CSV
          </button>
          <button className="export-btn pdf-export" onClick={handleExportPDF} disabled={reportData.length === 0}>
            Экспорт в PDF
          </button>
        </div>
      </div>

      {reportData.length > 0 && (
        <div className="report-results">
          <h3>Результаты отчета</h3>
          <div className="report-table-container">
            <table className="report-table">
              <thead>
                <tr>
                  {reportColumns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx}>
                    {reportColumns.map((col, colIdx) => (
                      <td key={colIdx}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;