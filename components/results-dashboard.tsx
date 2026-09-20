"use client";
import {useMemo,useState} from 'react';
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Line,LineChart,XAxis,YAxis} from 'recharts';
import {BarChart3,CalendarCheck,Euro,MoonStar,Receipt} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ChartContainer,ChartTooltip,ChartTooltipContent,type ChartConfig} from '@/components/ui/chart';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {monthly,euro,integer,type ResultRow} from '@/lib/collab';
const periods=[{id:3,label:'3 meses'},{id:6,label:'6 meses'},{id:12,label:'12 meses'},{id:0,label:'Tudo'}];
const revenueConfig={revenue:{label:'Receita',color:'var(--chart-1)'}} satisfies ChartConfig;
const volumeConfig={bookings:{label:'Reservas',color:'var(--chart-3)'},nights:{label:'Noites',color:'var(--chart-2)'}} satisfies ChartConfig;
export default function ResultsDashboard({rows,emptyText}:{rows:ResultRow[],emptyText:string}){
 const [period,setPeriod]=useState(6);
 const points=useMemo(()=>monthly(rows,period),[rows,period]);
 const total=useMemo(()=>points.reduce((t,p)=>({bookings:t.bookings+p.bookings,nights:t.nights+p.nights,revenue:t.revenue+p.revenue}),{bookings:0,nights:0,revenue:0}),[points]);
 if(!rows.length)return <Empty className="small-empty"><EmptyHeader><EmptyMedia variant="icon"><BarChart3/></EmptyMedia><EmptyTitle>Ainda não há resultados</EmptyTitle><EmptyDescription>{emptyText}</EmptyDescription></EmptyHeader></Empty>;
 return <div className="results-dashboard">
  <div className="results-toolbar"><span className="muted">Período apresentado</span><div className="period-toggle" role="group" aria-label="Período">{periods.map(p=><Button key={p.id} size="sm" variant={period===p.id?'default':'outline'} aria-pressed={period===p.id} onClick={()=>setPeriod(p.id)}>{p.label}</Button>)}</div></div>
  <div className="kpi-grid">
   <div className="kpi"><span className="kpi-icon"><CalendarCheck/></span><div><span>Reservas</span><strong>{integer(total.bookings)}</strong></div></div>
   <div className="kpi"><span className="kpi-icon coral"><MoonStar/></span><div><span>Noites vendidas</span><strong>{integer(total.nights)}</strong></div></div>
   <div className="kpi"><span className="kpi-icon navy"><Euro/></span><div><span>Receita gerada</span><strong>{euro(total.revenue*100)}</strong></div></div>
   <div className="kpi"><span className="kpi-icon"><Receipt/></span><div><span>Valor médio por reserva</span><strong>{total.bookings?euro(total.revenue*100/total.bookings):'—'}</strong></div></div>
  </div>
  <div className="chart-card"><h3>Receita por mês</h3><p>Valor faturado através do código promocional.</p>
   <ChartContainer config={revenueConfig} className="results-chart" role="img" aria-label="Gráfico da receita mensal"><AreaChart data={points} margin={{left:4,right:12,top:8}}><defs><linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={.28}/><stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={.02}/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}/><YAxis width={58} tickLine={false} axisLine={false} tickFormatter={v=>euro(v*100)}/><ChartTooltip content={<ChartTooltipContent formatter={(v)=>euro(Number(v)*100,2)}/>}/><Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#fillRevenue)"/></AreaChart></ChartContainer></div>
  <div className="chart-grid">
   <div className="chart-card"><h3>Reservas por mês</h3><p>Número de reservas confirmadas.</p>
    <ChartContainer config={{bookings:volumeConfig.bookings}} className="results-chart short" role="img" aria-label="Gráfico das reservas mensais"><BarChart data={points} margin={{left:0,right:8,top:8}}><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}/><YAxis width={34} allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip cursor={false} content={<ChartTooltipContent/>}/><Bar dataKey="bookings" fill="var(--color-bookings)" radius={[5,5,0,0]}/></BarChart></ChartContainer></div>
   <div className="chart-card"><h3>Noites vendidas</h3><p>Total de noites das reservas registadas.</p>
    <ChartContainer config={{nights:volumeConfig.nights}} className="results-chart short" role="img" aria-label="Gráfico das noites mensais"><LineChart data={points} margin={{left:0,right:12,top:8}}><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}/><YAxis width={34} allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip content={<ChartTooltipContent/>}/><Line dataKey="nights" type="monotone" stroke="var(--color-nights)" strokeWidth={2.5} dot={{r:3.5,fill:'var(--color-nights)'}}/></LineChart></ChartContainer></div>
  </div>
  <div className="chart-card"><h3>Detalhe mensal</h3><div className="table-scroll"><table className="results-table"><thead><tr><th>Mês</th><th>Reservas</th><th>Noites</th><th>Receita</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.month}><td>{p.label}</td><td>{integer(p.bookings)}</td><td>{integer(p.nights)}</td><td>{euro(p.revenue*100,2)}</td></tr>)}</tbody></table></div></div>
 </div>
}
