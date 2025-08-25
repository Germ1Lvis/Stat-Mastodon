
import React from 'react';

interface StatIconProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

const StatIcon: React.FC<StatIconProps> = ({ icon, value, label }) => {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="w-5 h-5">{icon}</div>
      <span className="font-mono text-sm">{value.toLocaleString('fr-FR')}</span>
    </div>
  );
};

export default StatIcon;
