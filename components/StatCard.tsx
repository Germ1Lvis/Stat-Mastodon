
import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <div className="bg-brand-surface p-4 rounded-lg text-center border border-gray-700">
      <p className="text-sm text-brand-text-secondary font-medium">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-brand-text mt-1">
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
    </div>
  );
};

export default StatCard;
