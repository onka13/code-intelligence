import React from 'react';

type Props = { start: number };

export class Counter extends React.Component<Props, { value: number }> {
  state = { value: this.props.start };

  componentDidMount(): void {}

  increment = (): void => this.setState({ value: this.state.value + 1 });

  render() {
    return <button onClick={this.increment}>{this.state.value}</button>;
  }
}

export const Badge = ({ label }: { label: string }) => <span>{label}</span>;
