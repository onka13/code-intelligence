using System.Text;
using Serilog;
using Shop.Domain;
using static System.Math;
using Clock = System.TimeProvider;

namespace Shop.Api.Services;

public sealed class OrderService(IOrderRepository repository, ILogger logger) : IOrderService
{
    public async Task<string> DescribeAsync(string id, CancellationToken cancellationToken)
    {
        var order = await repository.FindAsync(id, cancellationToken) ?? throw new KeyNotFoundException(id);
        logger.Information("Described {Id}", id);
        return new StringBuilder().Append(order.Id).Append(' ').Append(Round(order.Total, 2)).ToString();
    }

    private sealed class Cache
    {
        public int Size { get; set; }
    }
}

public interface IOrderService
{
    Task<string> DescribeAsync(string id, CancellationToken cancellationToken);
}
