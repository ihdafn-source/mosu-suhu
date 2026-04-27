const GradientRamp = () => {
	return (
		<div className="space-y-2">
			<div className="h-2.5 w-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-rose-400" />
			<div className="flex items-center justify-between font-data text-[11px] text-muted-foreground">
				<span>Sejuk</span>
				<span>Normal</span>
				<span>Waspada</span>
			</div>
		</div>
	);
};

export default GradientRamp;
