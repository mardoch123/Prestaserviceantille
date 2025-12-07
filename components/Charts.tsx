import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const COLORS = ['#2A9D8F', '#F4A261', '#E76F51', '#264653', '#E9C46A'];

interface ChartProps {
  data: any[];
}

export const TurnoverChart: React.FC<ChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
      <XAxis dataKey="name" tick={{fontSize: 10}} />
      <Tooltip 
        contentStyle={{ backgroundColor: '#fdfcf5', borderRadius: '8px', border: '1px solid #ddd' }} 
        formatter={(value: number) => [`${value} €`, 'CA']}
      />
      <Line type="monotone" dataKey="ca" stroke="#8c7352" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
    </LineChart>
  </ResponsiveContainer>
);

export const ClientsChart: React.FC<ChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
      <XAxis dataKey="name" tick={{fontSize: 10}} />
      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#fdfcf5', borderRadius: '8px' }} />
      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={index === 1 ? '#2A9D8F' : index === 2 ? '#E76F51' : '#F4A261'} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const MissionsChart: React.FC<ChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={40}
        outerRadius={70}
        fill="#8884d8"
        paddingAngle={5}
        dataKey="value"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px' }}/>
    </PieChart>
  </ResponsiveContainer>
);